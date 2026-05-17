# BarraBrava — Legal Notes (Argentine compliance)

**Last updated:** 2026-05-17
**Scope:** Phase 1 Foundation
**Status:** working document — IP lawyer review pending pre-launch (PROJECT.md top risk #1).

---

## Regulatory landscape

### Ley 25.326 — Protección de Datos Personales
- Aplica a cualquier base de datos con datos personales de residentes argentinos.
- Obliga a inscribir la base en el Registro Nacional de Bases de Datos (RNBD) ante la AAIP. **Deferida → ver [AAIP-REGISTRATION.md](AAIP-REGISTRATION.md).**
- Derechos ARCO (Acceso, Rectificación, Cancelación, Oposición) deben estar accesibles desde la privacy policy + canal de contacto.
- Transferencia internacional de datos (servidores fuera de Argentina): requiere base legal — usaremos consentimiento expreso en la privacy policy.

### Ley 24.240 — Defensa del Consumidor
- Aplica a la relación juego ↔ jugador en compras IAP.
- Términos claros, sin cláusulas abusivas, derecho de arrepentimiento de 10 días para compras a distancia (CABA: jurisprudencia variable para bienes digitales — el TOS lo declara expresamente).
- Información clara sobre lo que cada IAP entrega (cosmético = no afecta gameplay).

### Marco de propiedad intelectual (AFA + clubes)
- **Riesgo alto** — uso de nombres de clubes argentinos reales en parodia.
- **Mitigación Phase 1 (DISPLAY):** TODO lo que ve el jugador usa nombres lunfardo / parodia (ej. River → "Los Millos", Boca → "La Mitad+1", Argentinos → "El Bicho"). Cliente Godot (`ClubCard.gd`, `ClubPickerScreen.gd`) solo renderiza `lunfardo_name`, nunca `id`.
- **Concesión 2026-05-17 (INTERNAL IDs):** los `id` de Storage / API responses usan slugs de nombre real (`boca_juniors`, `river_plate`, `argentinos_juniors`) para facilitar al dev mantener el catálogo de 153 clubes. **Estos IDs no se muestran en UI** — solo aparecen en network responses crudas, logs server-side, y Postgres Storage keys. Mitigación adicional pendiente: en Phase 7 pre-launch revisar si conviene reemplazar IDs por hash opaco (ej. `c_a3f9b2`) para borrar incluso esa exposición técnica antes de soft launch.
- **Mitigación Phase 1:** paletas de color "loosely inspired", NO copia directa de escudos oficiales. 8 archetypes en uso: `shield_curved`, `shield_pointed`, `classic_horizontal_stripe`, `classic_vertical_stripe`, `sash`, `oval_crest`, `circle_crest`, `quarters`.
- **Pre-launch:** revisión por abogado IP argentino (presupuesto $$$). Verificar si la parodia caricaturesca cumple "uso lícito" o si requiere licencia AFA (negociación posible).
- **Pre-launch:** revisión App Store / Google Play guidelines sobre uso de marcas deportivas en juegos.

### Política Apple App Store + Google Play
- **Edad mínima del jugador: 13 años** (COPPA + Google Play familias). Hardcoded en `AppConfig.MIN_AGE`.
- Phase 1 acepta-términos checkbox declara expresamente "mayor a 13".
- **No gambling / no loot boxes / no gacha** (PROJECT.md constraint + Argentina regula apuestas). Monetización 100% cosmética (skins, trapos, banderas vector-only en Phase 1).
- **Sin chat libre / sin UGC abierto** en Phase 1 (UGC vector-only de trapos en v2 con moderación).

### Tono y sensibilidad cultural (CLAUDE.md)
- Caricaturesco, fantasy-coded — **nunca glorificar violencia barra real**.
- **Apolítico** — sin banderas partidarias, sin referencias a partidos políticos argentinos reales.
- **Sin nombres reales de líderes barra** existentes (legal + ético).
- App Store rejection risk: "promotes gang violence" → mitigación es framing: estrategia, lunfardo, gestión de barra como organización folclórica.

## Phase 1 deliverables (legal-adjacent)

| Artefacto | Estado | Path |
|-----------|--------|------|
| Privacy Policy ES | ✓ creada | `web/privacy/index.html` |
| Privacy Policy EN | ✓ creada | `web/privacy/en.html` |
| Terms of Service ES | ✓ creada | `web/terms/index.html` |
| Password Reset page | ✓ creada (stub) | `web/reset-password/index.html` |
| Accept-terms checkbox enforcement | ✓ AuthScreen Registrarse tab | `scripts/screens/AuthScreen.gd` |
| AAIP registration | ⏳ DEFERRED Phase 6/7 | [AAIP-REGISTRATION.md](AAIP-REGISTRATION.md) |
| Resend SMTP for legal notices | ⏳ DEFERRED Phase 2 | INFRA-NOTES.md |
| Custom domain | ⏳ DEFERRED Phase 2 | INFRA-NOTES.md |
| IP lawyer review (AFA parodia) | ⏳ DEFERRED pre-launch | this doc — top risk #1 |

## Contact placeholder (pre-domain)

Until custom domain is registered:
- **Legal contact:** `legal@barrabrava.com.ar` (pending domain registration — currently unable to receive)
- **Privacy contact:** `privacy@barrabrava.com.ar` (idem)
- **Workaround Phase 1:** users see these emails in the privacy/terms pages BUT a banner at top of those pages declares "Phase 1 closed beta — feedback channel: GitHub Issues at https://github.com/lukasval/barrabrava/issues".

## Phase 2+ legal TODOs

1. Register custom domain → enable Resend → emails work.
2. Privacy/Terms pages: add real responsible party (razón social) once decided (persona física o SAS).
3. Start AAIP trámite (≥1 month pre-launch).
4. IP lawyer review of club parodies + iconography.
5. Add cookie banner (web/) when adding analytics (currently no cookies because no analytics).
6. Geo-block check: confirm Argentine compliance does NOT require blocking other jurisdictions; align with Google Play country availability.
