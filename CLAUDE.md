# BarraBrava — Project Guide

Mobile multiplayer game about Argentine football barras bravas. Solo developer with Claude Code. Real AFA calendar drives in-game events. Cosmetic-only monetization.

## Workflow

This project uses **Get-Shit-Done (GSD)** methodology. Planning artifacts live in `.planning/`.

**Key files:**
- `.planning/PROJECT.md` — vision, scope, decisions
- `.planning/REQUIREMENTS.md` — v1/v1.1/v2 requirements with REQ-IDs
- `.planning/ROADMAP.md` — 7-phase execution plan
- `.planning/STATE.md` — current progress
- `.planning/research/` — domain research (stack, features, architecture, pitfalls, summary)
- `.planning/config.json` — workflow preferences

## Stack (locked-in via research)

- **Client:** Godot 4.3 (MIT, cross-platform mobile)
- **Backend:** Nakama 3.x self-hosted on Railway São Paulo
- **DB:** PostgreSQL (bundled w/ Nakama)
- **Push:** FCM v1 API
- **Fixture data:** API-Football (Primera + Nacional) + scraping/manual (B Metro, Federal A, C Metro)
- **CDN:** Cloudflare R2 (zero egress)
- **IAP:** RevenueCat (server-side validation via REST API)
- **Analytics:** GameAnalytics
- **CI/CD:** GitHub Actions + Fastlane

## Critical Constraints

- **Solo dev** — scope decisions must respect 1-person bandwidth
- **Budget ~$40/mo total** (Claude $20 + Railway $20-40)
- **Server-authoritative for everything** that matters (resources, combat, GPS, IAP, seasons)
- **No free-text chat ever** (moderation untenable)
- **No gacha / loot boxes** (Argentine regulation + Apple/Google policies)
- **Cosmetic-only monetization** (anti-P2W is core value)
- **5 AFA divisions**: Primera + Nacional + B Metro + Federal A + C Metro (~130 clubes paramétricos)
- **AI barras = pilar v1** (resuelve first-day population)

## Tone & Cultural Sensitivities

- **Caricaturesco, fantasy-coded** — never glorify real barra violence
- **Lunfardo / jerga argentina** — auténtico, no español neutro
- **Apolítico** — sin party flags, sin referencias políticas reales
- **Sin nombres reales** de líderes barra existentes (legal + ético)
- **Parodia de clubes**, no marcas oficiales

## Top Risks (consult PITFALLS.md before relevant work)

1. AFA trademark — parodia + IP lawyer review pre-launch
2. App Store rejection "gang violence" — lunfardo naming + strategy framing
3. AFA feed instability — paid tier + admin manual override
4. GPS spoofing (post-v1) — plausibility checks + cap bonus
5. UGC abuse (v2 only) — vector-only trapos en v1

## Current Phase

**Phase 1: Foundation** — pending. Run `/gsd-plan-phase 1` to start.

## Commands

- `/gsd-plan-phase N` — create PLAN.md for phase
- `/gsd-execute-phase N` — execute plans for phase
- `/gsd-progress` — check current state
- `/gsd-discuss-phase N` — explore phase context before planning

---
*Updated: 2026-05-14*
