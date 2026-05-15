# Phase 1: Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-14
**Phase:** 1-Foundation
**Areas discussed:** Flow de registro / auth, Sistema de identidades paramétricas, Secuencia onboarding + creación de pibe, CI/CD + build pipeline

---

## Flow de registro / auth

| Option | Description | Selected |
|--------|-------------|----------|
| Email + password | Simple, Nakama built-in, control total sobre datos | ✓ |
| Email + password + Google OAuth | Menor abandono en registro, más implementación | |
| Guest mode primero | Menor fricción inicial, complica recuperación de cuenta | |

**User's choice:** Email + password

---

| Option | Description | Selected |
|--------|-------------|----------|
| Splash + directo a login/registro | Simple, sin lobby | |
| Landing con preview del juego | Más atractivo, más trabajo UI | |
| You decide | Lo más rápido para MVP | ✓ |

**User's choice:** Claude discretion (splash simple recomendado)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Token de sesión persistido localmente | Re-login automático, estándar Nakama | ✓ |
| Login manual cada vez | Más simple, UX muy mala | |

**User's choice:** Token persistido localmente con refresh

---

| Option | Description | Selected |
|--------|-------------|----------|
| Email de reseteo via Nakama built-in | SMTP configurable, mínimo viable | ✓ |
| Soporte vivo (Discord/email manual) | Sin SMTP, no escala | |

**User's choice:** Email reset via Nakama SMTP

---

## Sistema de identidades paramétricas

| Option | Description | Selected |
|--------|-------------|----------|
| Data estática semillada (JSON + SQL) | Simple, reproducible, control de versiones | ✓ |
| Generación procedural en runtime | Automático pero impredecible | |
| Arte manual por illustrador | Costo y tiempo inviable para Phase 1 | |

**User's choice:** JSON seed en repo + migración SQL

---

| Componente | Selected |
|------------|----------|
| Nombre paramédico (lunfardo) | ✓ |
| Paleta de 2 colores primarios | ✓ |
| Forma base de escudo (6-8 arquetipos) | ✓ |
| Barrio HQ real | ✓ |

**User's choice:** Los 4 componentes

---

| Option | Description | Selected |
|--------|-------------|----------|
| Solo Primera División (26 clubes) | MVP rápido | |
| 5 divisiones completas (~130 clubes) | Seed se hace una vez, sistema completo | ✓ |

**User's choice:** 5 divisiones desde Phase 1

---

## Secuencia onboarding + creación de pibe

| Option | Description | Selected |
|--------|-------------|----------|
| Registro → Club picker → Facción → Nombre pibe → Stats | Flujo narrativo | |
| Registro → Nombre pibe → Club picker → Facción | Personaje primero | |
| You decide | Planner elige | |

**User's choice:** Registro → Club picker → Nombre pibe → Tutorial breve → Home
**Notes:** **Clarificación clave:** No hay selección de facción en onboarding. Las facciones no se eligen — se *crean* por los jugadores para tomar el control político de la barra.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Stats fijos base iguales para todos | Justo, simple, rol se desarrolla jugando | ✓ |
| El jugador elige distribución de puntos | Más engagement, más scope | |

**User's choice:** Stats fijos base iguales

---

| Option | Description | Selected |
|--------|-------------|----------|
| Placeholder genérico (silueta/icono) | MVP, no bloquea Phase 1 con arte | ✓ |
| Avatar básico customizable | Algo visual día 1, más scope | |

**User's choice:** Placeholder genérico

---

## CI/CD + build pipeline

| Option | Description | Selected |
|--------|-------------|----------|
| Debug builds (APK + IPA) que compilan sin error | Valida build sin certificates | ✓ |
| Release builds listos para TestFlight + Play Internal | Más setup ahora | |

**User's choice:** Debug builds

---

| Option | Description | Selected |
|--------|-------------|----------|
| Diferir Fastlane a Phase 7 | Pragmático para solo dev | |
| Configurar Fastlane básico desde Phase 1 | Pipeline completo desde inicio | |
| You decide | | ✓ |

**User's choice:** Claude discretion

---

| Option | Description | Selected |
|--------|-------------|----------|
| Railway desde Phase 1 | Evita divergencia dev/prod | ✓ |
| Docker local primero, Railway en Phase 2-3 | Más rápido al principio | |

**User's choice:** Railway desde Phase 1

---

| Option | Description | Selected |
|--------|-------------|----------|
| main = producción, develop = staging | GitHub Flow básico | ✓ |
| Solo main | Más simple | |

**User's choice:** main/develop con CI en PRs

---

## Claude's Discretion

- Pantalla pre-login: splash simple recomendado (no landing elaborada)
- Fastlane setup: diferir a Phase 7
- Schema exacto de stats del pibe (atributos específicos, rango de valores)
- Cantidad exacta de arquetipos de escudo (6-8 sugeridos)
- SMTP provider para email reset (SendGrid o Resend)
- Estructura JSON del seed de clubes

## Deferred Ideas

- Fastlane completo → Phase 7
- FCM push notifications → Phase 2
- Facciones completas → Phase 3 y Phase 5
- Avatar cosmético / outfit → Phase 5-6
- Tutorial "primera salida" (ONB-05/06) → Phase 3
- RevenueCat IAP → Phase 6
- OAuth social login → post-MVP
