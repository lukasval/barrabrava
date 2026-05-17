# AAIP Database Registration Checklist (deferred to Phase 6/7)

**Status:** ⏳ DEFERRED. To be filed ≥1 month before soft launch (trámite tarda 2-4 semanas async).
**Legal basis:** Ley 25.326 (Protección de Datos Personales, Argentina) + Disposición AAIP 60/2016.
**Authority:** Agencia de Acceso a la Información Pública (AAIP) — argentina.gob.ar/aaip.

---

## When to file

Trigger: **≥30 días antes del soft launch (Phase 7)** OR before accepting first real Argentine user, whichever comes first. The registration must be active (estado "Inscripta") before public open beta.

If timeline slips and trámite is not yet "Inscripta", soft launch must be limited to closed beta with explicit consent + a notice that registration is in trámite.

## What is registered

A "Base de Datos con Datos Personales" titulada **BarraBrava — Cuentas de Jugador**, containing:

| Categoría | Campo | Origen | Fin |
|-----------|-------|--------|-----|
| Identificación | email | usuario al registrarse | login, recuperación de contraseña |
| Identificación | nombre del pibe (in-game) | usuario al crear pibe | identificación dentro del juego |
| Auth | password hash (bcrypt vía Nakama) | usuario al registrarse | autenticación |
| Vínculo | club elegido | usuario al picker | pertenencia in-game |
| Session | session token + refresh token | Nakama al loguearse | mantener sesión activa |
| Telemetría | ❌ NO (analytics DEFERRED a Phase 6+) | — | — |
| Ubicación | ❌ NO (GPS DEFERRED a v1.1) | — | — |

No se almacenan: nombre real, DNI, teléfono, dirección, datos sensibles (salud, religión, ideología, orientación sexual).

## Filing steps (when triggered)

1. **TAD (Trámites a Distancia)** → argentina.gob.ar/aaip → "Inscripción de Bases de Datos"
2. Acreditar identidad con AFIP CUIT (responsable del tratamiento = el dev / razón social).
3. Completar formulario:
   - Denominación: "BarraBrava — Cuentas de Jugador"
   - Finalidad: prestar el servicio de juego mobile multiplayer
   - Categorías de datos: ver tabla arriba
   - Transferencia internacional: SÍ (servidores Railway/Fly.io, posiblemente US East mientras São Paulo no esté disponible). Declarar país destino + base legal (consentimiento del titular en la privacy policy).
   - Medidas de seguridad: TLS in transit, bcrypt at rest, sin datos sensibles
   - Plazo de conservación: mientras la cuenta exista + 30 días post-baja
   - Cesión a terceros: NO (cosmetic-only monetization via Apple/Google IAP no cede datos personales)
4. Subir privacy policy publicada (URL: https://lukasval.github.io/barrabrava/privacy/, o el dominio custom cuando esté registrado).
5. Pagar arancel (gratuito para personas físicas hasta 2024 — verificar al momento del trámite).
6. Esperar resolución AAIP (~2-4 semanas).
7. **Guardar número de trámite (ej. `EX-2026-XXXXXXXX-APN-DNPDP#AAIP`) y la resolución de inscripción.** Anotar en INFRA-NOTES.md sección AAIP cuando esté Inscripta.

## What changes in code/UX after registration

- AuthScreen privacy text incluye: "Inscripta en AAIP RNBD bajo número X-XXXXX-X-XXXX" (Disposición AAIP 7/2019 art. 5).
- Privacy policy (web/privacy/) actualizada con: razón social del responsable, número RNBD, link a derechos ARCO (acceso/rectificación/cancelación/oposición), email para ejercer derechos.
- Si AAIP requiere data protection officer (DPO) — verificar umbral de cantidad de titulares.

## Reversal trigger (early registration)

If at any point during Phase 2-5 we begin onboarding real Argentine users (closed beta with >50 accounts), START THE TRÁMITE IMMEDIATELY — do not wait for Phase 7.

## References

- Ley 25.326: https://servicios.infoleg.gob.ar/infolegInternet/anexos/60000-64999/64790/norma.htm
- Disposición AAIP 60/2016: registro RNBD obligatorio.
- Disposición AAIP 7/2019: art. 5 obliga a indicar nº RNBD en formularios de captación de datos.
- Process docs: argentina.gob.ar/aaip/datos-personales/registro
