// Reset password page — CHK-06 redesigned to AVOID exposing the Nakama server credential in public JS.
//
// Strategy:
// 1. Get token from URL ?token=<reset-token>
// 2. Perform an unauthenticated device auth call: POST /v2/account/authenticate/device
//    with id = "reset-helper-" + token (Nakama allows anonymous device auth WITHOUT any
//    server-side credential — the endpoint accepts no-auth requests by default; the public
//    host is injected by deploy workflow but nothing sensitive is ever shipped to the browser).
// 3. The response contains a short-lived Bearer token (NakamaSession.token).
// 4. Use the Bearer token to call /v2/rpc/confirm_password_reset with the actual reset token
//    in the payload.
//
// Result: the only thing leaked publicly is the host name. No server key in JS.
//
// Phase 1 note: the server-side `confirm_password_reset` RPC is a STUB that returns
// {ok:false, error:"feature_unavailable_phase_1"} because Resend + verified domain are
// deferred to Phase 2. The UI handles that error gracefully with a friendly message.

(function () {
  "use strict";

  // CONFIG — replaced at deploy time by .github/workflows/deploy-web.yml
  // (host is public, NOT a secret — same hostname users see in network traffic).
  var NAKAMA_HOST = "REPLACE_WITH_NAKAMA_HOST";

  var params = new URLSearchParams(window.location.search);
  var token = params.get("token") || "";
  var form = document.getElementById("reset-form");
  var status = document.getElementById("status");
  var intro = document.getElementById("intro");
  var submitBtn = document.getElementById("submit-btn");

  if (!token) {
    intro.textContent = "Link inválido — no se encontró el token.";
    form.style.display = "none";
    return;
  }

  function setStatus(text, kind) {
    status.textContent = text;
    status.dataset.kind = kind || "info";
  }

  // Step 1: Anonymous device auth — Nakama accepts this without a server key when
  // the endpoint is configured publicly (default). The "id" is just a per-flow unique string.
  async function fetchBearerToken() {
    var deviceId = "reset-helper-" + token + "-" + Date.now();
    // Pad to >= 10 chars (Nakama requirement); token + suffix already exceeds it.
    var resp = await fetch(
      "https://" + NAKAMA_HOST + "/v2/account/authenticate/device?create=true",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deviceId }),
      }
    );
    if (!resp.ok) {
      throw new Error("device-auth-failed:" + resp.status);
    }
    var data = await resp.json();
    if (!data || !data.token) {
      throw new Error("device-auth-no-token");
    }
    return data.token;
  }

  async function callResetRpc(bearer) {
    // Nakama expects RPC payload as a JSON-encoded string in the body.
    var payload = JSON.stringify({
      token: token,
      new_password: document.getElementById("pw").value,
    });
    var body = JSON.stringify(payload);
    var resp = await fetch(
      "https://" + NAKAMA_HOST + "/v2/rpc/confirm_password_reset?unwrap",
      {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + bearer,
          "Content-Type": "application/json",
        },
        body: body,
      }
    );
    if (!resp.ok) {
      var errText = await resp.text();
      throw new Error(errText || "rpc-" + resp.status);
    }
    // Server may return {ok:true} or a stub {ok:false, error:"feature_unavailable_phase_1"}.
    var rpcResp = await resp.json().catch(function () { return null; });
    if (rpcResp && typeof rpcResp === "object") {
      // When ?unwrap is used, the body may already be the inner payload.
      // Some Nakama versions still wrap; parse the payload string if present.
      var inner = rpcResp;
      if (rpcResp.payload && typeof rpcResp.payload === "string") {
        try {
          inner = JSON.parse(rpcResp.payload);
        } catch (e) {
          inner = rpcResp;
        }
      }
      if (inner && inner.ok === false && inner.error) {
        throw new Error(inner.error);
      }
    }
    return true;
  }

  form.addEventListener("submit", async function (ev) {
    ev.preventDefault();
    var pw = document.getElementById("pw").value;
    var pw2 = document.getElementById("pw2").value;
    if (pw.length < 8) {
      setStatus("Mínimo 8 caracteres, chabón.", "error");
      return;
    }
    if (pw !== pw2) {
      setStatus("Las contraseñas no coinciden.", "error");
      return;
    }
    submitBtn.disabled = true;
    setStatus("Procesando...", "info");

    try {
      var bearer = await fetchBearerToken();
      await callResetRpc(bearer);
      setStatus(
        "Contraseña actualizada. Volvé a la app y entrá con tu nueva contraseña.",
        "success"
      );
      form.style.display = "none";
    } catch (e) {
      var msg = String((e && e.message) || e);
      if (msg.indexOf("feature_unavailable_phase_1") !== -1) {
        setStatus(
          "El reseteo todavía no está habilitado en esta versión. Estará operativo en la próxima fase del juego — escribinos a soporte@barrabrava.com.ar si necesitás acceso urgente.",
          "info"
        );
        // Re-enable so user can copy-paste link to a friend or retry later.
        submitBtn.disabled = false;
        return;
      }
      if (msg.indexOf("expired") !== -1) {
        setStatus("Link vencido. Pedí uno nuevo desde la app.", "error");
      } else if (msg.indexOf("Invalid") !== -1 || msg.indexOf("invalid") !== -1) {
        setStatus("Link inválido o ya usado.", "error");
      } else if (msg.indexOf("device-auth-failed") !== -1) {
        setStatus(
          "Sin conexión con el servidor. Probá de nuevo en unos segundos.",
          "error"
        );
      } else {
        setStatus("Algo salió mal: " + msg.slice(0, 200), "error");
      }
      submitBtn.disabled = false;
    }
  });
})();
