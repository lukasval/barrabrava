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
- [ ] Sistema de clubes reales de AFA: **5 divisiones** — Primera División + Primera Nacional + B Metropolitana + Federal A + C Metropolitana (~130 clubes). Excluye Regional Amateur (demasiados). Identidades paramétricas (no comisión por club).
- [ ] Fixture data multi-fuente: API-Football para Primera + Nacional; scraping AFA o feed manual para B Metro, Federal A, C Metro
- [ ] Personaje propio (pibe) con sistema de skills asignables desde pool compartido
- [ ] Roles tácticos para pibes reclutados: trompada, aguantador, corredor, vigía, líder, pirotécnico, abogado, barrabrava viejo
- [ ] **Eje 1 — Sistema Laboral (qué hacés)**: trabajos que TODOS hacen, incluido el líder. Trapito, vendedor (chori/paty/entradas/merch/bengalas), patovica, remisero, etc. El líder tiene tareas propias específicas (negociar dirigentes, conseguir entradas, hablar con cana). Genera plata personal y/o pozo grupal según tipo de trabajo.
- [ ] **Eje 2 — Jerarquía Política (qué mandás)**: posición de poder dentro de la barra. Niveles: Pibe → Soldado → Capo de Facción → Mesa Chica → Líder de Barra. Determina qué decisiones podés tomar y qué recursos administrás.
- [ ] **Eje 3 — Facciones Internas (dónde estás parado)**: sub-grupos dentro de la misma barra (ej. "Zona Sur" vs "Zona Norte"). Pueden tener líderes propios, enemistades internas, voto de censura al líder, golpes de estado, traiciones (alianzas con facciones de otros clubes).
- [ ] Turno de Barra en día de partido: consume Energía, genera pozo grupal + prestigio personal
- [ ] Profesión libre en días sin partido: genera plata personal para cosméticos
- [ ] Recursos por trabajo: Plata (personal), Aguante (grupal), Reputación (política), Visto Bueno Cana (anti-heat)
- [ ] Mesa Chica: top jugadores de la barra. Vota decisiones grupales junto al Líder (uso del pozo, targets, alianzas). Composición incluye representantes de facciones.
- [ ] Skills de profesión: desbloqueables según horas trabajadas en cada rubro
- [ ] Drama emergente entre facciones: voto de censura, golpe de estado, traición (alianza secreta con barra rival), divisiones públicas en el feed
- [ ] **Barras IA (pilar v1, no opcional)**: pibes IA que pueblan todas las barras desde el día 1. Atacan, defienden, suben jerarquía, ocupan facciones, generan feed. Indistinguibles de jugadores reales a primera vista. Resuelve first-day population problem + mantiene densidad en clubes chicos (divisiones bajas). Reemplazables por jugadores reales cuando aparecen.
- [ ] "Cancha" / base híbrida: estructura propia + reputación de barra
- [ ] Recursos: Aguante (principal), Trapos/Banderas (especial), Reputación de Barrio (territorial), Moneda Premium (cosméticos)
- [ ] Sistema de combate: ventanas calendarizadas según fixture AFA real, free-for-all con feudos dinámicos por temporada
- [ ] Emboscadas planificables: elegir ubicación, hora, composición, intel de vigías
- [ ] **Sistema de combate estratégico (no RPS, no azar dominante)**: 6 decisiones interactuantes pre-ataque — intel pre-raid (trade-off resources), composición squad (cubrir frentes tácticos), ubicación (modifiers fijos por barrio), timing dentro de ventana de partido, formación (frontal/pinza/emboscada/señuelo/hit-and-run, no cíclica), contingencia escape
- [ ] Defensor pre-configura: trampas, posiciones pibes por frente, plan retirada, llamado auxilio (push a facción para refuerzo en tiempo real)
- [ ] Resolución determinística por frentes tácticos: cada frente se evalúa con modifiers visibles, ratio frentes ganados/perdidos escala outcome. Azar ±10% solo como sabor (cana inesperada, lluvia, etc.)
- [ ] Contraintel: vigía rival puede detectar reconocimiento y devolver intel falsa. 2 vigías reduce probabilidad de engaño. Mind games entre hardcore.
- [ ] Cronista del Aguante (LLM-generated narrative feed): crónica semanal auto-generada por club, historia personal del pibe, eventos editoriales estilo Olé chamuyero. Modelo barato (Haiku) genera 90%.
- [ ] Progresión visible del pibe: avatar cambia con rango (rifado, tatuajes, cicatrices, mejor ropa). Hitos con cinematic (primer trapo, primer golpe estado, primer Superclásico).
- [ ] **Aguantadero geográfico**: HQ de barra en barrio real (Avellaneda, La Boca, Núñez, etc.). Visible para todos, blanco de raid.
- [ ] **Outfit identitario**: pibe tiene ropa visible (gorra, campera, mochila, zapatillas, jean). Cosmetic monetization directa. Outfit identifica facción interna.
- [ ] **Loadout por raid**: bengalas (+daño área, +heat), palos (+cuerpo a cuerpo), capucha (-ID cana), bombo (+recibimiento, target obvio), pelotas (efecto cómico viral), manos vacías (0 heat, escape rápido). Multiplica decisiones tácticas.
- [ ] **Pibes con personalidad emergente**: 1-2 traits aleatorios por pibe (Cabezón, Pies de plomo, Camorrero, Buchón, Pichón, Cordobés, etc.). Narrativa gratis, cada barra única.
- [ ] **Seasonal modifiers rotativos**: cada temporada AFA tiene gimmick que cambia reglas (Temporada del fuego = bengalas 2x; Temporada cana brava = heat 1.5x; etc.). Live ops sin reescribir el juego.
- [ ] **Daily mini-puzzle táctico**: 1 minuto, situación preseteada, elegí mejor jugada. Habit-forming barato, cero infra extra.

### Active (post-MVP, v1.1)

- [ ] Citaciones cara a cara entre barras (combate agendado con countdown público)
- [ ] Top Boys públicos: top 5 pibes de cada barra con perfil visible, target en la espalda
- [ ] Reputación pública de barra: perfil con Aguante / Respeto / Notoriedad / Trapos / historial
- [ ] Metagame comunitario tipo Helldivers: objetivos semanales globales por club (tomar zona X), todos contribuyen, todos reciben recompensa
- [ ] Emotes socialmente cargados anti-club: cantitos provocativos como cosméticos virales
- [ ] Mecánica de topo / traición: pibe Buchón puede filtrar info, mini-juego de identificarlo dentro de la facción

### Active (v2 / futuro)

- [ ] Viajes de visitante: caravanas a estadio rival con riesgo de emboscada en ruta
- [ ] Persecuciones policiales activas: mini-eventos post-raid (correr / esconder / sobornar / entregarse)
- [ ] Arco narrativo de temporada (LLM-generado): historia central por season, eventos progresan el arco
- [ ] Caravanas de logística: pibes mueven trapos/recursos entre aguantaderos, interceptables = sub-juego de robo
- [ ] Diplomacia visible (líder + Mesa Chica): pactos públicos de no agresión, alianzas temporales, traiciones con penalización
- [ ] Última Fecha mega-event: 24hs caóticas de free-for-all sin ventanas en última jornada AFA real
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
- Regional Amateur — demasiados clubes, fixture data inviable
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
