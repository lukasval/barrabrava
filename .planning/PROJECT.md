# BarraBrava

## What This Is

Juego mobile multiplayer online ambientado en la cultura de barras bravas argentinas. Cada jugador representa a una persona real dentro de la barra de un club real de AFA, construye su reputación, recluta pibes con roles tácticos, planifica emboscadas contra barras rivales durante ventanas de partido, y compite por dominar territorio en un mapa central de Argentina. Vibe "Hooligans: Storm Over Europe" mezclada con Clash of Clans, sincronizado con la realidad del fútbol argentino. Monetización 100% cosmética estilo Fortnite (trapos custom, outfits, efectos, bombos, cánticos).

## Core Value

**La realidad del fútbol argentino afecta el juego en tiempo real**, y cada jugador es un personaje real dentro de la barra de su club — con riesgo, tensión táctica y orgullo en juego. Si esto falla, no hay juego.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Mobile-first (iOS + Android), online multiplayer
- [ ] Sistema de clubes reales de AFA (Primera División mínimo)
- [ ] Personaje propio (pibe) con sistema de skills asignables desde pool compartido
- [ ] Roles tácticos para pibes reclutados: trompada, aguantador, corredor, vigía, líder, pirotécnico, abogado, barrabrava viejo
- [ ] Sistema de Carrera dentro de la barra: escalera de puestos (trapito → vendedor → patovica → trompada → mano derecha → capo de facción → líder de barra)
- [ ] Turno de Barra en día de partido: consume Energía, genera pozo grupal + prestigio personal
- [ ] Profesión libre en días sin partido: trapito, vendedor (chori/paty/entradas/merch/bengalas), remisero, etc. — genera plata personal para cosméticos
- [ ] Recursos por trabajo: Plata (personal), Aguante (grupal), Reputación (escalada), Visto Bueno Cana (anti-heat)
- [ ] Mesa Chica: top 5-10 jugadores de la barra. Vota decisiones grupales junto al Líder (uso del pozo, targets, alianzas)
- [ ] Skills de profesión: desbloqueables según horas trabajadas en cada rubro
- [ ] "Cancha" / base híbrida: estructura propia + reputación de barra
- [ ] Recursos: Aguante (principal), Trapos/Banderas (especial), Reputación de Barrio (territorial), Moneda Premium (cosméticos)
- [ ] Sistema de combate: ventanas calendarizadas según fixture AFA real, free-for-all con feudos dinámicos por temporada
- [ ] Emboscadas planificables: elegir ubicación, hora, composición, intel de vigías
- [ ] Sistema de daño escalado: rasguñazo → paliza → robo bombo → robo trapo (golpe máximo)
- [ ] Robo de trapo: humillación pública en feed + pérdida temporal hasta recuperación
- [ ] Riesgo real de perder pibes (permadeath si caen sin rescate de abogado)
- [ ] Sistema "heat / cana": atención policial escalada, encarcelamientos, rescate vía abogado
- [ ] Mapa central de Argentina con territorios disputables y dominio visible por club
- [ ] Jerarquía interna del club: líder de barra otorga bonuses al resto; múltiples vías para acceder al puesto (aguante, votación, desafío)
- [ ] Bonus geo-localizado: detección GPS cerca del estadio en día de partido = bonus de recursos/XP
- [ ] Sincronización con resultado real del partido: ventana de batalla durante 90 min + bonus al ganador real
- [ ] Sistema de seasons espejado al torneo AFA real (start/end match calendar real)
- [ ] Reset parcial + recompensas exclusivas de fin de temporada
- [ ] Campeón AFA real → buff temporada siguiente para esa barra; descenso real → penalización
- [ ] Eventos dinámicos: clásicos = double XP/recompensa; superclásicos = ventana extendida
- [ ] Feed social in-game con virales (robos de trapo, emboscadas exitosas, replays compartibles)
- [ ] Pase de temporada cosmético estilo battle pass
- [ ] Monetización 100% cosmética: skins de pibe, trapos custom, bombos, humo, cánticos, animaciones de victoria
- [ ] Drops sincronizados con realidad (ej. gol clave Selección → drop nacional)

### Out of Scope

- Apuestas / gambling con dinero real — riesgo legal, ético, regulatorio
- Violencia gráfica explícita / sangre / armas letales — store policies, tono caricaturesco
- Pay-to-win (stats compradas) — rompe Core Value y la economía competitiva
- Chat de voz libre — moderación inviable solo dev, riesgo de toxicidad/odio
- Clubes del exterior en v1 — foco AFA primero, Libertadores/Sudamericana en futuro
- Modo offline / single-player — todo el valor está en el multiplayer + realidad sincronizada
- Web/Desktop en v1 — mobile only hasta validar mercado
- Sistema de equipos cruzados entre clubes (alianzas permanentes Boca+River) — rompe lore

## Context

**Cultural fit:** Argentina tiene una de las culturas de fútbol más intensas del mundo. El folklore de barra (trapos, bombos, cánticos, aguante, banderazos, recibimientos) es altamente identitario y monetizable como cosmético. Nadie está explotando esto en gaming todavía.

**Inspiraciones declaradas:**
- Hooligans: Storm Over Europe (2002) — tactical firm management, ambush, roles
- Clash of Clans — base building, raids, clanes, recursos
- Pokémon GO — geo-bonus en estadio
- Fortnite — modelo de monetización cosmética + battle pass
- FIFA Ultimate Team — integración con calendario real

**Tono:** Caricaturesco, no realismo violento. Más "Los Simuladores barra brava" que "City of God". Humor argentino, autoreferencial, lunfardo. Evitar glorificar violencia real — exagerar para que sea claramente fantasía.

**Sensibilidades a manejar:**
- Las barras bravas reales tienen historial violento serio. El juego debe ser fantasy-coded, no apología.
- Evitar nombres de barras reales / referentes reales — usar parodia o nombres genéricos por club.
- Moderación fuerte de contenido user-generated (trapos custom pueden ser problema).
- Política argentina: evitar referencias políticas reales, banderas partidarias, etc.

**Solo dev:** Solo desarrollador. Restringe alcance v1: foco MVP jugable, no todo a la vez.

## Constraints

- **Equipo:** Solo desarrollador — alcance MVP debe ser realista para 1 persona
- **Plataforma:** Mobile iOS + Android — implica framework cross-platform o nativo doble
- **Tech stack:** Por definir en research (probable: Unity/Godot/Flutter+backend serverless o similar)
- **Backend:** Multiplayer requiere servidor authoritativo, persistencia, sync con calendario AFA real
- **Datos externos:** Integración con feed de fixtures + resultados AFA en tiempo real (API third-party o scraping legal)
- **Geolocalización:** GPS opt-in, manejo de privacidad / GDPR-equivalente argentino (Ley 25.326)
- **Moderación:** Sistemas auto + reportes de contenido user-generated (nombres, trapos custom, chat)
- **App Store policies:** Sin gambling, sin violencia gráfica, sin pay-to-win loops abusivos
- **Monetización:** 100% cosmética, sin ventajas competitivas pagas
- **Legal:** Cuidado con uso de marcas/escudos de clubes reales — licenciamiento o parodia/uso nominativo
- **Capital:** Solo dev sin capital declarado — soluciones serverless/cheap-tier hasta validar

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Mobile-first (iOS + Android) | Máximo alcance en Argentina, soporte GPS y notificaciones nativas | — Pending |
| Geo-location opcional (bonus, no requisito) | Inclusivo para jugadores fuera de zona del club + privacy-friendly | — Pending |
| Modelo Clash of Clans (no Pokémon GO ni Fortnite puro) | Mecánica de base + raids + clanes calza con barra/club/territorio | — Pending |
| Combate calendarizado por fixture AFA real | Core Value: la realidad afecta el juego. Sin esto el juego pierde identidad | — Pending |
| Free-for-all con sistema de feudos dinámicos | Más político y emergente que rivalidades fijas; permite drama entre temporadas | — Pending |
| Permadeath de pibes con rescate vía abogado | Mayor tensión táctica, decisiones pesadas — alineado con vibe SoE | — Pending |
| Robo de trapo = humillación pública + pérdida temporal | Balance entre castigo doloroso y casual-friendly (no hardcore total) | — Pending |
| Seasons espejadas al torneo AFA real | Refuerza Core Value, retención natural sincronizada con realidad | — Pending |
| Monetización 100% cosmética | Evita pay-to-win, alineado con Fortnite-style sustainability | — Pending |
| Sin clubes del exterior en v1 | Alcance acotado para solo dev, foco identidad argentina primero | — Pending |
| Tono caricaturesco / fantasy-coded | Evita problemas legales/éticos sobre violencia real de barras | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-14 after initialization*
