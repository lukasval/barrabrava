# Phase 3: Core Loop Laboral - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-18
**Phase:** 3-core-loop-laboral
**Areas discussed:** Day cycle & work model, Resource economy (rates + caps), Recruitment flow + trait reveal, Hierarchy in AI-populated barras

---

## Day cycle & work model

### Q1 — Work model

| Option | Description | Selected |
|--------|-------------|----------|
| Idle generation offline | Pibé asignado a profesión genera Plata mientras jugador desconectado. Cap máximo fuerza check-in diario. Mobile-friendly. | ✓ |
| Tap-to-collect on demand | Cada session el jugador toca "trabajar" + consume Energía + tiempo real corto. Active engagement. | |
| Shift scheduling | Jugador agenda turno X horas, pibé ocupado, vuelve con loot. | |

### Q2 — Idle cap

| Option | Description | Selected |
|--------|-------------|----------|
| 8h cap | Sweet spot mobile: check-in al despertar + post-laburo. Estilo Clash. | |
| 12h cap | Más indulgente. Jugador puede dejar todo el día sin perder. | ✓ |
| 4h cap (aggressive) | Force múltiples check-ins. Mayor habit pero risk frustrante. | |
| No cap, decay slow | Acumula indefinido pero rate decae 50% post-12h. | |

### Q3 — Match day mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Active commit during window | Botón "Hacer turno" en HomeScreen cuando ventana abre. Jugador selecciona pibes, consume Energía. | ✓ |
| Auto-deploy on subscribe | Pibes auto-van con recompensa parcial; full si commits. | |
| Optional opt-in pre-window | Opt-in antes; ejecución automática cuando ventana abre. | |

### Q4 — Energía model

| Option | Description | Selected |
|--------|-------------|----------|
| Per-pibé regen passive | Cada pibé tiene Energía (max 100). Regen +5/h offline. Turno consume 30-50. Rota pibes. | ✓ |
| Shared barra pool | Una Energía compartida (max ~500). Forza priorización. | |
| No energía — cooldown per pibé | 1 turno por ventana, sin meter. Simpler. | |

---

## Resource economy (rates + caps)

### Q1 — Plata rate model

| Option | Description | Selected |
|--------|-------------|----------|
| Low base + profession bonus | Base ~10 Plata/h. Multiplier por profesión + skill grind escala. | ✓ |
| Flat rate per profession | Cada profesión rate fijo. Sin skill scaling. Simpler. | |
| Profession + trait modifiers | Profession base + trait modifiers (Cabezón -20%, etc). | |

### Q2 — Turno output

| Option | Description | Selected |
|--------|-------------|----------|
| Split: Aguante grupal + Reputación personal | Por pibé en turno: ~50 Aguante al pozo grupal + ~20 Reputación personal. | ✓ |
| Aguante only, Rep via combat | Turno solo da Aguante. Rep gana via combate Phase 4. | |
| Reputación only, Aguante via aguantadero | Turno da Rep. Aguante grupal viene de aguantadero. | |

### Q3 — VBC source Phase 3

| Option | Description | Selected |
|--------|-------------|----------|
| Líder-only profesión "hablar cana" | Solo Líder puede asignar tiempo a hablar cana. Da peso al rol. | ✓ |
| Trade Plata por VBC | Cualquier jugador convierte Plata a VBC en "sobornar cana". | |
| Defer entirely to Phase 4 | VBC no se acumula en Phase 3. | |

### Q4 — Daily caps

| Option | Description | Selected |
|--------|-------------|----------|
| Soft caps via energy + idle cap | Sin daily caps duros. Throttle natural via Energía + idle cap 12h. | ✓ |
| Daily cap on Reputación only | Plata + Aguante uncapped; Rep cap ~500/día previene whale-stomps políticos. | |
| Catch-up modifier | +30% rate si lejos del top. F2P-style. | |

---

## Recruitment flow + trait reveal

### Q1 — Recruit how

| Option | Description | Selected |
|--------|-------------|----------|
| Daily recruit pool refresh | 3 pibes/día. Refresh madrugada. Costo Plata + Rep mín. Scouting feel. | ✓ |
| Recruit at barrios (geographic) | Pibes spawneados por barrio del club con bias de rol. Más sabor pero requiere mapa UI. | |
| Open pool, costo escalado | Lista grande siempre disponible, costo escala con roster size. | |

### Q2 — Trait reveal

| Option | Description | Selected |
|--------|-------------|----------|
| Role + 1 trait visible, 2da oculta | Card muestra rol + 1 trait. 2da reveal post-reclutamiento. Mezcla scouting + sorpresa. | ✓ |
| Everything visible | Todo visible. Decisión pura estratégica. Min-maxer-friendly. | |
| Only role visible, traits hidden | Solo rol + avatar. Traits sorpresa total. Máxima narrativa pero gacha-y. | |

### Q3 — Pibe source

| Option | Description | Selected |
|--------|-------------|----------|
| Infinite procedural spawn | Server genera names/avatares/traits procedurally. Sin riesgo de quedarte sin pibes. | ✓ |
| Shared pool with AI barras | Pibes IA reclutables si capos AI mueren. Requires Phase 4 combate infra. | |
| Finite per-club pool with refresh | Pool global por club, refresh weekly. Scarcity refleja realidad. | |

### Q4 — Recruit cost

| Option | Description | Selected |
|--------|-------------|----------|
| Plata + Reputación mínima por rango | Costo escala con rango: Pibe limita, Soldado más, Capo libre. Ganás status antes de scalar roster. | ✓ |
| Plata only, no Rep gate | Solo Plata. Less friction onboarding. | |
| Plata + tiempo (cooldown) | Plata + cooldown 24h. Premia decisión vs cantidad. | |

---

## Hierarchy in AI-populated barras

### Q1 — Sub-rank promotion

| Option | Description | Selected |
|--------|-------------|----------|
| Threshold Rep auto-promote | Reputación cruza umbral → auto-promote. Pibe→Sold 500, Sold→Capo 2500, Capo→Mesa 10000. Sin votación. | ✓ |
| Auto + Mesa review for Capo+ | Pibe→Sold auto; Sold→Capo Mesa vote; Mesa→Líder election. Politics from Capo+. | |
| Everything Mesa-voted | Toda promo Mesa-voted daily. Maximum political feel pero high friction. | |

### Q2 — Mesa Chica composition

| Option | Description | Selected |
|--------|-------------|----------|
| Top 5 by Reputación, mixed AI/human | Top 5 absoluto. Day 1: 100% AI. Humans replace AI al exceed Rep. Compact, scales naturally. | ✓ |
| Top 10, facción-proportional | 10 con 2-3 por facción. Forces faction politics. Más drama. | |
| Top 5 + Líder appoints 2 | Top 5 + 2 appointed. Da poder al Líder. Requires appointment UI. | |

### Q3 — Líder election

| Option | Description | Selected |
|--------|-------------|----------|
| Highest Rep at season-end | Top Rep al cierre de season AFA = Líder próxima season. Grindeo acumulativo. JER-04 voto = stretch v1.1. | ✓ |
| Mesa Chica vote at season-end | Mesa vota Líder cada season. AI vota weighted. Requires voting UI. | |
| Challenge-based + season default | Default top Rep + challenges mid-season. Drama mayor pero más complex. | |

### Q4 — Facciones Phase 3 role

| Option | Description | Selected |
|--------|-------------|----------|
| Onboarding pick visible only, JER-05 deferred | Facción visible como label + filter. Sin Capo de Facción, sin drama. JER-05..07 defer Phase 5. | ✓ |
| Capo per facción via Rep | Top Rep dentro de facción = Capo automático. Sin poderes mecánicos en Phase 3. | |
| Full facción politics in Phase 3 | Capos electos, votos de censura, traición. Riesgo scope creep. | |

---

## Claude's Discretion

Áreas donde Claude tiene flexibilidad (delegadas explícitamente):
- Storage schema detallado de cada collection (JSON value shape).
- Idempotencia de RPCs y patterns de marker fields.
- RPC naming exacto (sugerido en CONTEXT.md §Claude's Discretion).
- Validation server-side detallada.
- Godot screens layout + componentes reusables.
- AI baseline Rep curve para Mesa Chica day-1.
- Tutorial scripted state machine detalles.
- Avatar composition paramétrica (params concretos).
- Procedural name list amplificación.
- Trait pool list completa final.
- Plata/Rep/Aguante starting balance al crear cuenta.

## Deferred Ideas

### Phase 4 (Combate Estratégico)
- PIB-08 permadeath; HEA-* heat/cana/abogado.
- VBC consumption en combate.
- Multiplicadores de turno por loadout/formación.
- AIB-01..05 IA barras combate behaviors.

### Phase 5 (Mundo Social)
- JER-05..07 facciones drama (Capos, votos, golpes, traición).
- Mesa Chica acciones reales (votos, pozo grupal use).
- Líder challenge mid-season (JER-04 mention).
- Cronista LLM narrar ascensos.
- Recruit modes "shared con AI barras" + "geographic by barrios".
- Catch-up modifier para nuevos (analytics-driven decision).

### Phase 6 (Monetización)
- Cosméticos shop wire al primer trapo + cántico desbloqueado.
- Drops Selección.
- Battle Pass wired al loop laboral.

### v1.1 / Post-launch
- JER-04 elección activa con voto + challenge.
- Tradeoff Plata ↔ VBC para no-Líderes (analytics-gated).
- Daily cap on Rep (analytics-gated).
- Trait reveal A/B test (everything-visible vs only-role).
- Líder "negociar dirigentes" / "conseguir entradas" con efecto mecánico real.
