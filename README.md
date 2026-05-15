# BarraBrava

Juego mobile multiplayer sobre barras bravas argentinas. Proyecto solo-dev con Claude Code.

> **Tono:** caricaturesco, lunfardo argentino, apolítico, parodia de clubes (no marcas oficiales). El juego nunca glorifica violencia real de barras existentes.

## Stack

- **Cliente:** Godot 4.3 (MIT, cross-platform mobile)
- **Backend:** Nakama 3.21 self-hosted en Railway (placeholder hasta migración a Fly.io São Paulo)
- **DB:** PostgreSQL (bundled con Nakama)
- **Email:** Resend (3K emails/mes free tier) — pendiente Phase 2
- **Push:** FCM v1 API — Phase 2
- **CDN:** Cloudflare R2 (cero egress) — Phase 5
- **IAP:** RevenueCat — Phase 6
- **Analytics:** GameAnalytics — Phase 2
- **CI/CD:** GitHub Actions (Android APK debug; iOS difiere a Phase 7)

## Setup local

> _Pendiente — Plan 02 (Wave 1) define el bootstrap del proyecto Godot._

Requisitos previstos:
- Godot 4.3 stable
- Android SDK + JDK 17 (para builds locales)
- Node.js 18+ (para Nakama TypeScript runtime — Plan 03)
- Cuenta Railway con `DATABASE_URL` y env vars de Nakama configuradas

## Deploy

> _Pendiente — el deploy a Railway se configura en el Plan 01 (Wave 0)._

- `main` → producción (auto-deploy a Railway)
- `develop` → staging / integración (CI corre pero no deploya)
- `fly.toml` queda en repo como artefacto para migración futura a Fly.io `gru` (São Paulo).

## Workflow GSD

Este proyecto usa la metodología **Get-Shit-Done (GSD)**. Todos los artefactos de planning viven en `.planning/`.

- `.planning/PROJECT.md` — visión, scope, decisiones
- `.planning/REQUIREMENTS.md` — requirements v1/v1.1/v2 con REQ-IDs
- `.planning/ROADMAP.md` — plan de ejecución 7-phase
- `.planning/STATE.md` — progreso actual
- `.planning/phases/` — context, research, plans y summaries por fase

Comandos clave (vía Claude Code):

- `/gsd-plan-phase N` — generar PLAN.md para una fase
- `/gsd-execute-phase N` — ejecutar los planes de la fase
- `/gsd-progress` — consultar estado actual

## Licencia

TBD (pre-launch).
