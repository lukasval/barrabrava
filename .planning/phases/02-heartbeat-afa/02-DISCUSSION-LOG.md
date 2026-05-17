# Phase 2: Heartbeat AFA - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `02-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-05-17
**Phase:** 02-heartbeat-afa
**Areas discussed:** Scheduler architecture, Lower-division ingestion, Push notification model, Admin override + season control (todos delegados a Claude)

---

## Round 1 — Area selection

Claude presented 4 gray areas with code-context annotations:

| Option | Description | Selected |
|--------|-------------|----------|
| Scheduler architecture | In-process Nakama timer vs pg_cron vs worker externo | (delegado a Claude) |
| Lower-division ingestion | Scraping AFA vs feed manual vs defer a v1.1 | (delegado a Claude) |
| Push notification model | FCM topics por club vs device tokens stored per user | (delegado a Claude) |
| Admin + season control | Admin RPCs Postman vs web tool vs in-game; season auto vs manual vs híbrido | (delegado a Claude) |

**User's choice:** Free text — `"no tengo idea que es, hace lo que creas relevante para un juego decente"`

**Notes:** User es solo dev sin background técnico AFA/Nakama profundo; pide que Claude tome todas las decisiones técnicas. Discussion mode pivot: en lugar de drill-down por área, Claude muestra defaults recomendados y pide confirmación.

---

## Round 2 — Defaults confirmation

Claude mostró un block de 6 defaults (scheduler, lower-divisions, push, admin/season, Resend, ventana state machine) y ofreció 4 opciones de confirmación:

| Option | Description | Selected |
|--------|-------------|----------|
| OK todo, escribí CONTEXT.md | Aplicar 6 defaults tal cual | (no elegido por menú) |
| Quiero tocar lower-divisions | Negociar scope scraping AFA | |
| Quiero tocar push notifications | Negociar scope notificaciones | |
| Quiero tocar dominio + Resend | Negociar compra dominio / Resend activation | |

**User's choice:** Free text — `"te sigo dejando a vos la decision de todo. yto no hice/compre nada aun. Segui armando todo para un juego decente AA"`

**Notes clave:**
- User confirma delegación total de decisiones técnicas.
- User explicita que **no compró nada todavía** — sin dominio, sin Resend cuenta, sin API-Football paid, sin GCP/FCM project. Phase 2 debe asumir todo el setup desde cero o diferir lo que dependa de compras.
- User target = `"juego decente AA"`. Claude interpretó esto como: robustez > features. Idempotencia, observabilidad mínima, audit trail admin, copy lunfardo cuidada. Mejor features menos ambiciosos pero pulidos que muchos sin pulir.

---

## Claude's Discretion (final decisions tomadas sin pregunta)

1. **Scheduler architecture (D-01..D-04)** → In-process Nakama `nk.timerCreate` con dos cadencias (15min/6h). Razón: preserva patrón Phase 1, cero servicios extra, dentro del budget.
2. **Lower-divisions ingestion** → DEFER a v1.1. Clubes seleccionables siguen disponibles pero marcados "Coming soon — sin partidos vivos esta season". Razón: evita 2+ semanas de scraping frágil; mantiene Phase 2 a 2-3 semanas; lower divisions tienen menor base de jugadores en Argentina.
3. **Push notification model (D-09..D-15)** → Híbrido topics + tokens. Topic `club_{id}` para "ventana abre" (broadcast, zero state). Token-per-user infra preparada pero no usada en Phase 2 (queda para Phase 4+ events personales). Razón: aprovecha simplicidad de topics sin cerrar la puerta a personalización futura.
4. **Admin override** → RPCs `admin_*` con bearer token env-var, callables vía curl. Sin UI dedicada. Razón: solo dev, minimum viable, documentado en INFRA-NOTES.md.
5. **Season detection** → Híbrido auto + admin. Auto-detect desde API-Football `season` field + cluster de fixtures; admin RPC override para edge cases (suspensión, descenso atípico). Razón: realista — AFA hace cosas raras seguido.
6. **Resend wiring (D-24..D-27)** → Phase 2 implementa toda la lógica interna (token gen, persist, expire, validate, consume) pero la llamada HTTP a Resend queda detrás de flag `RESEND_ENABLED=false`. Activación real Phase 6/7 cuando dominio comprado. Razón: zero blockers en Phase 2 por compras pendientes; switch de una sola env var cuando user esté listo.
7. **API-Football tier** → free tier (100 req/día) para Phase 2 dev. Paid tier roadmapped Phase 6 prelaunch. Razón: free tier alcanza para dev/testing; paid es requisito prelaunch documentado en PITFALLS.md.
8. **Copy lunfardo del push** → title `"¡Ventana abierta!"`, body `"Tu club juega ahora. Mové el orto al aguantadero."`. Razón: tono consistente con CLAUDE.md (lunfardo, fantasy-coded).

---

## Deferred Ideas (recogidos durante discussion)

- Scraping AFA para B Metro / Federal A / C Metro → v1.1
- Custom domain registration → Phase 6/7 prelaunch (depende de user)
- Resend live wiring → Phase 6/7 una vez dominio comprado
- API-Football paid tier → Phase 6 prelaunch
- Per-user push (te atacaron, pibe preso) → Phase 4
- Daily reset push → Phase 3
- Heat / cana event push → Phase 4
- Quiet hours / per-user push opt-out → v1.1
- Web admin UI dedicada → Phase 5+ si curl RPCs molestos
- Token GC dedicado → Phase 6+
- Métricas Prometheus → Phase 7
- Season modifiers gameplay → Phase 6
- Multi-timezone → post-MVP
- Push copy personalizado por matchup → v1.1

---

*Discussion mode: default (no flags). Two rounds: area-selection + defaults-confirmation. User delegó decisiones técnicas a Claude en ambos rounds.*
