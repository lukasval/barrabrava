# Phase 1: Foundation - Context

**Gathered:** 2026-05-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Infraestructura técnica completa + onboarding del jugador. Al final de esta fase: la app buildea para iOS y Android desde GitHub Actions, el jugador puede crear una cuenta, elegir su club de entre ~130 clubes con identidades paramétricas, crear su pibe, y llegar a la home screen. Nakama corre en Railway São Paulo. Los datos persisten en Postgres. Privacy policy accesible en español.

**Scope exacto:**
- Setup de proyecto Godot 4.3 + estructura de directorios
- Nakama 3.x en Railway São Paulo + schema Postgres inicial
- CI/CD con GitHub Actions (debug builds APK + IPA)
- Auth: registro y login email+password
- Club picker: 130 clubes con identidades paramétricas (seed completo, 5 divisiones AFA)
- Creación de pibe: nombre + stats base fijos + avatar placeholder
- Tutorial breve post-creación → Home screen
- Privacy policy en español accesible desde la app

**No incluye:** fixture feed, sistema de combate, ventanas de partido, recursos/profesiones, FCM push notifications (solo foundation técnica de FCM si aplica), sistema completo de facciones (las facciones se crean en el juego, no se eligen en onboarding).

</domain>

<decisions>
## Implementation Decisions

### Autenticación
- **D-01:** Registro y login exclusivamente con email + password. Sin OAuth social, sin guest mode en Phase 1.
- **D-02:** Sesión manejada con token de sesión Nakama persistido localmente (SecureStorage o similar). Re-login automático si el token es válido; refresh automático si expiró.
- **D-03:** Password recovery vía email de reseteo usando el sistema built-in de Nakama. Requiere configurar SMTP (SendGrid o similar).
- **D-04:** Pre-login: pantalla simple (splash/loading → login/registro). Sin landing page elaborada.

### Identidades Paramétricas de Clubes
- **D-05:** Las identidades de clubes son **data estática semillada**: un archivo `clubs.json` en el repositorio define los 130 clubes. Una migración SQL/script lo carga a Postgres en el deploy inicial.
- **D-06:** Componentes de cada club en el seed: (1) nombre paramédico en lunfardo (parodia, no nombre real), (2) paleta de 2 colores primarios (hex), (3) forma base de escudo (6-8 arquetipos predefinidos: escudo clásico, redondo, oval, shield inglés, etc.), (4) barrio HQ real (ej: La Boca, Avellaneda, Núñez).
- **D-07:** Se seedean las **5 divisiones AFA completas desde Phase 1** (~130 clubes): Primera División, Primera Nacional, B Metropolitana, Federal A, C Metropolitana. La lógica de fixture feed va en Phase 2, pero el catálogo de clubes está completo desde Phase 1.
- **D-08:** El club picker necesita búsqueda/filtrado por nombre y division dado el volumen de 130 clubes.

### Onboarding y Creación de Pibe
- **D-09:** Flujo de onboarding: **Registro → Club picker → Nombre del pibe → Tutorial breve → Home screen**.
- **D-10:** **No hay selección de facción en el onboarding.** Las facciones son sub-grupos que los jugadores crean dentro de la barra para tomar el control político. En Phase 1, el jugador entra directo a la barra del club sin sub-grupo asignado.
- **D-11:** Stats base del pibe al crearse: **fijos e iguales para todos** (ej: Fuerza 5, Velocidad 5, Aguante 5, Astucia 5). El rol y especialización se desarrollan jugando en phases posteriores.
- **D-12:** Avatar del pibe en Phase 1: **placeholder genérico** (silueta/icono). El sistema cosmético de outfit va en phases posteriores.
- **D-13:** El tutorial breve post-creación es una pantalla de bienvenida orientativa (no el tutorial completo "primera salida" que es Phase 3 ONB-05/06). Introduce el concepto de barra, aguante, y qué puede hacer el jugador.

### CI/CD y Infraestructura
- **D-14:** CI/CD en Phase 1 produce **debug builds** (APK para Android + IPA sin firmar para iOS) que compilan sin error. No se requieren provisioning profiles ni certificados de distribución en Phase 1.
- **D-15:** Nakama se despliega en **Railway São Paulo desde Phase 1** (no Docker local). El entorno de desarrollo apunta a Railway desde el día 1. Evita divergencia dev/prod.
- **D-16:** Branch strategy: `main` = producción (deploy Railway automático), `develop` = staging. PRs a `main` triggerean CI check.

### Claude's Discretion
- Fastlane setup: diferir a Phase 7 (Polish + Launch). Phase 1 usa solo GitHub Actions con Godot export CLI.
- Schema exacto de stats del pibe (nombres de atributos, rango de valores): Claude define lo más lógico para el sistema de combate futuro.
- Cantidad exacta de arquetipos de forma de escudo (6-8 sugeridos).
- SMTP provider para email reset (SendGrid o Resend son razonables).
- Estructura exacta del JSON seed de clubes: Claude define el schema más apropiado.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `CLAUDE.md` — Guía de proyecto: stack, constraints, tono cultural, comandos
- `.planning/PROJECT.md` — Visión, core value, requirements activos, decisiones clave
- `.planning/REQUIREMENTS.md` — Requirements con IDs para Phase 1: TEC-01..10, ONB-01..04, CLB-01..02, PRV-01..05

### Research (Phase 1 específico)
- `.planning/research/STACK.md` — Stack técnico investigado: Godot 4.3, Nakama 3.x, Railway, FCM, R2, RevenueCat, GameAnalytics. Incluye items [VERIFY] que deben chequearse.
- `.planning/research/ARCHITECTURE.md` — Arquitectura server-authoritative, servicios core, build order recomendado.
- `.planning/research/PITFALLS.md` — Riesgos críticos relevantes: trademark clubes, App Store rejection framing, datos AFA.
- `.planning/research/SUMMARY.md` — Síntesis ejecutiva: stack, decisiones clave, critical path.

### Roadmap
- `.planning/ROADMAP.md` — Phase 1 goal, success criteria, outputs esperados.

No hay specs/ADRs externos — requirements completamente capturados arriba.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Ninguno — proyecto nuevo, cero código existente. Todo desde cero.

### Established Patterns
- Ninguno aún. Phase 1 establece los patrones base para las phases siguientes.

### Integration Points
- Nakama SDK en Godot 4.3 es el punto de integración principal (verificar madurez según STACK.md [VERIFY] items).
- CI/CD en GitHub Actions como hub de todos los builds futuros.

</code_context>

<specifics>
## Specific Ideas

- Los nombres paramédicos de clubes deben ser en **lunfardo argentino**, caricaturescos, sin usar el nombre real del club. Ej: River Plate → "Los Millo", Boca Juniors → "Los Xene", Independiente → "Los Diablos". El escudo/badge usa la paleta de colores real del club pero con forma genérica (ningún escudo oficial replicado).
- El Club picker debe mostrar la **división** de cada club (Primera, Nacional, etc.) para ayudar al jugador a identificar su club.
- La **Privacy Policy en español** debe ser accesible desde la pantalla de registro (antes de crear cuenta) y desde settings. Requerimiento PRV-01.
- El disclaimer de ficción ("Este juego es una parodia ficticia, no representa a entidades reales") debe aparecer en el primer launch. Requerimiento CLB-02.

</specifics>

<deferred>
## Deferred Ideas

- **Fastlane setup completo** (submission a App Store / Play Store) → Phase 7 (Polish + Launch)
- **FCM push notifications operativas** → Phase 2 (Heartbeat AFA)
- **Sistema de facciones completo** → Phase 3 (Core Loop Laboral) y Phase 5 (Mundo Social)
- **Avatar cosmético / sistema de outfit** → Phase 5-6
- **Tutorial completo "primera salida"** (ONB-05/06) → Phase 3
- **RevenueCat IAP integration** → Phase 6
- **OAuth social login** (Google, Apple) → Post-MVP si métricas muestran abandono en registro

</deferred>

---

*Phase: 1-Foundation*
*Context gathered: 2026-05-14*
