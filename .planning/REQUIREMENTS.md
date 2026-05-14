# Requirements: BarraBrava

**Defined:** 2026-05-14
**Core Value:** La realidad del fútbol argentino afecta el juego en tiempo real, y cada jugador es un personaje real dentro de la barra de su club — con riesgo, tensión táctica y orgullo en juego.

**Scope strategy (freelancer solo dev + Claude Code budget):** v1 = MVP mínimo divertido. v1.1 = depth + retention. v2 = ambición.

---

## v1 Requirements (MVP — 4-6 meses)

### Onboarding & Identidad

- [ ] **ONB-01**: Player se registra con email/password (o social login OAuth Google/Apple)
- [ ] **ONB-02**: Player selecciona club entre ~130 clubes (Primera, Nacional, B Metro, Federal A, C Metro)
- [ ] **ONB-03**: Player elige facción interna inicial dentro de su club (ej. "Zona Sur", "Zona Norte", "Bajo", etc. — 2-4 por club)
- [ ] **ONB-04**: Player crea su pibe — nombre, apariencia base, asignación de stats iniciales desde pool compartido
- [ ] **ONB-05**: Tutorial guiado primera salida (<10 min): reclutar primer pibe, primer turno, primer ataque scripted contra IA
- [ ] **ONB-06**: Recompensa primera sesión: primer trapo de barra + primer cántico desbloqueado

### Clubes & Datos AFA

- [ ] **CLB-01**: Sistema de identidad paramétrica para los ~130 clubes (colores, patrón de escudo generativo, nombre, barrio HQ)
- [ ] **CLB-02**: Disclaimer "ficción inspirada en folklore argentino" + nombres parodiados (no marcas oficiales)
- [ ] **CLB-03**: Fixture feed integrado vía API-Football (Primera + Nacional) + scraping admin manual (B Metro, Federal A, C Metro)
- [ ] **CLB-04**: Admin panel solo-dev para override manual de fixtures (postergaciones, cambios)
- [ ] **CLB-05**: Cache de fixtures con TTL 30 min, fallback a último cache si feed cae

### Aguantadero & Recursos

- [ ] **AGT-01**: Cada player tiene aguantadero (HQ) ubicado en barrio real del club elegido
- [ ] **AGT-02**: Aguantadero tiene niveles upgradeables: capacidad de pibes, almacén de recursos, bandera room (display trapos), defensa
- [ ] **AGT-03**: Recursos del juego: Plata (personal), Aguante (grupal de barra), Reputación (política), Visto Bueno Cana (anti-heat)
- [ ] **AGT-04**: Generación pasiva de Aguante según nivel de aguantadero + turnos de barra
- [ ] **AGT-05**: Bandera room muestra trapos robados públicamente (humillación visual)

### Pibes & Sistema Laboral (Eje 1)

- [ ] **PIB-01**: Roster de pibes reclutables (max 5 inicial, escala con rango hasta 20)
- [ ] **PIB-02**: Cada pibe tiene roles tácticos: trompada, aguantador, corredor, vigía, líder, pirotécnico, abogado, viejo
- [ ] **PIB-03**: Cada pibe tiene 1-2 traits de personalidad aleatorios (Cabezón, Pies de plomo, Camorrero, Buchón, Pichón, Cordobés, Porteño, etc.)
- [ ] **PIB-04**: Sistema laboral: profesiones disponibles (trapito, vendedor chori/paty/entradas/merch/bengalas, patovica, remisero) — el líder tiene tareas propias (negociar dirigentes, conseguir entradas, hablar cana)
- [ ] **PIB-05**: Trabajo en día sin partido genera Plata personal (cosméticos)
- [ ] **PIB-06**: Turno de Barra en día de partido consume Energía → genera Aguante grupal + Reputación personal
- [ ] **PIB-07**: Skills de profesión desbloqueables por horas trabajadas
- [ ] **PIB-08**: Pibes pueden caer permadeath si arrestados sin abogado dentro de 24h reales (cana)

### Jerarquía Política (Eje 2) & Facciones (Eje 3)

- [ ] **JER-01**: Niveles jerárquicos: Pibe → Soldado → Capo de Facción → Mesa Chica → Líder de Barra
- [ ] **JER-02**: Promoción por Reputación acumulada + votación de Mesa Chica
- [ ] **JER-03**: Mesa Chica = top jugadores de la barra (5-10), vota uso del pozo grupal y targets
- [ ] **JER-04**: Líder elegido cada season AFA por voto + Reputación; puede ser desafiado por challenge directo
- [ ] **JER-05**: Facciones internas (2-4 por club) con líderes propios (capo de facción)
- [ ] **JER-06**: Líder inactivo 5+ días = Mesa Chica puede llamar voto emergencia
- [ ] **JER-07**: Drama emergente: voto de censura al líder, golpe de estado, traición (sin mecánica completa v1, solo eventos de feed)

### Combate Estratégico

- [ ] **CMB-01**: Ventanas de combate sincronizadas con fixture AFA: abre 2h antes de kickoff, cierra 2h post-final
- [ ] **CMB-02**: Live match window (90 min): combate más rápido, doble recompensa
- [ ] **CMB-03**: Pre-raid: jugador toma 6 decisiones interactuantes
  - Intel de vigía (3 niveles de costo / completitud)
  - Composición squad (cubrir frentes tácticos)
  - Ubicación (barrio real con modifiers fijos visibles)
  - Timing dentro de ventana
  - Formación táctica (frontal / pinza / emboscada / señuelo / hit-and-run)
  - Contingencia escape (corredor extra opcional)
- [ ] **CMB-04**: Loadout por raid: bengalas, palos, capucha, bombo, pelotas, manos vacías. Trade-offs declarados.
- [ ] **CMB-05**: Defensor pre-configura: trampas, posiciones por frente, plan de retirada, push de auxilio a facción
- [ ] **CMB-06**: Resolución determinística por frentes tácticos + ±10% azar (sabor)
- [ ] **CMB-07**: Outcomes escalados: rasguñazo → paliza → robo bombo → robo trapo
- [ ] **CMB-08**: Robo de trapo = humillación pública en feed + pérdida temporal (recovery raid disponible 72h con buff +20%)
- [ ] **CMB-09**: Contraintel: vigía rival puede detectar reconocimiento y devolver info falsa; 2 vigías reducen probabilidad de engaño
- [ ] **CMB-10**: Replay de raid generado server-side (seed + action log), client-side rendering

### Mapa Territorial

- [ ] **MAP-01**: Mapa central de Argentina dividido en ~60-80 zonas (barrios, ciudades)
- [ ] **MAP-02**: Cada zona claimable por barras vía combate
- [ ] **MAP-03**: Display de ownership con colores de club + porcentaje de dominio
- [ ] **MAP-04**: Home zone de cada club = bonus defensivo + Aguante extra
- [ ] **MAP-05**: Update visual del mapa post-ventanas de combate

### Heat / Cana

- [ ] **HEA-01**: Meter de heat (1-5 estrellas) que sube por ataques, raids exitosos, eventos
- [ ] **HEA-02**: Cana: pibes arrestados van a "cana" tras raids con alto heat
- [ ] **HEA-03**: Abogado (rol pibe) puede rescatar pibes presos costando Aguante + tiempo
- [ ] **HEA-04**: Pibes presos sin rescate en 24h reales = permadeath
- [ ] **HEA-05**: Heat decae con inactividad

### Seasons (sincronizadas AFA)

- [ ] **SEA-01**: Season = duración real del torneo AFA (Apertura o Clausura)
- [ ] **SEA-02**: Season comienza al arrancar torneo real, termina al terminar
- [ ] **SEA-03**: Modificadores de season rotativos ("Temporada del fuego" = bengalas 2x, "Cana brava" = heat 1.5x, "Pibes" = rookies 2x XP, etc.)
- [ ] **SEA-04**: End-of-season: snapshot rankings, soft reset (retain 40% Aguante, 20% Trapos, pibes survive)
- [ ] **SEA-05**: Champion AFA real → buff de temporada siguiente para esa barra
- [ ] **SEA-06**: Relegación real → penalización temporal a esa barra
- [ ] **SEA-07**: Pre-season window (2 semanas): solo construcción/reclutamiento, sin combate

### IA Barras (pilar)

- [ ] **AIB-01**: Cada barra (~130) tiene población base de pibes IA desde día 1
- [ ] **AIB-02**: Pibes IA atacan, defienden, suben rango, ocupan facciones, contribuyen al pozo
- [ ] **AIB-03**: Pibes IA generan eventos de feed (raids, robos, drama interno) para dar vida
- [ ] **AIB-04**: Pibes IA reemplazables por jugadores reales cuando aparecen (player asume slot vacante)
- [ ] **AIB-05**: Dificultad de IA escala con nivel del jugador (no whale-stomps-newbie)

### Social & Feed

- [ ] **SOC-01**: Feed in-game auto-generado: raids, robos, ascensos, eventos de facción
- [ ] **SOC-02**: Feed global + feed de tu club + feed de tu facción (3 tabs)
- [ ] **SOC-03**: Cronista del Aguante (LLM Haiku-generated): crónica semanal por club, historia personal del pibe — estilo Olé chamuyero
- [ ] **SOC-04**: Replay viewer compartible (link público, posteable a redes)
- [ ] **SOC-05**: Trapo humiliation card auto-generada al robo, formato Instagram/WhatsApp shareable
- [ ] **SOC-06**: Sin chat de texto libre (anti-toxicidad). Solo reacciones preset.

### Daily Engagement

- [ ] **DAY-01**: Daily mini-puzzle táctico: 1 min, situación preseteada, elegir mejor jugada. Bonus chico diario.
- [ ] **DAY-02**: Daily objectives: 3 misiones rotativas (trabajo, combate, reclutamiento)
- [ ] **DAY-03**: Push notifications: ventana abre, te atacaron, robaron trapo, pibe preso, daily reset

### Monetización Cosmética

- [ ] **MON-01**: Moneda premium "Fichas" comprable vía Google Play / Apple IAP
- [ ] **MON-02**: Battle Pass de season (2 tracks: free + premium ~ARS 2-4K, Netflix-anchor)
- [ ] **MON-03**: Shop rotativo semanal: outfit, trapos preset, bombos, humo, cánticos, animaciones
- [ ] **MON-04**: Drops sincronizados con realidad (gol clave Selección → drop nacional)
- [ ] **MON-05**: Sin gacha / loot boxes (todo direct purchase, items mostrados)
- [ ] **MON-06**: Pricing ARS friendly (tier mínimo ARS 500-1000)
- [ ] **MON-07**: Cosmetic gifting entre miembros de misma barra

### Moderación & Safety

- [ ] **MOD-01**: Filtro de nombres (deny list de slurs, políticos, barras reales, jugadores reales)
- [ ] **MOD-02**: Sistema de reportes (3 strikes → auto-hide pending review)
- [ ] **MOD-03**: Sin UGC de imágenes en v1 (trapos custom = vector-only con templates)
- [ ] **MOD-04**: Trapos preset diseñados por dev (no upload de imagen raw v1)
- [ ] **MOD-05**: Sin chat texto libre
- [ ] **MOD-06**: Tono caricaturesco, "ficción" splash screen al primer launch

### Privacidad & Legal

- [ ] **PRV-01**: Privacy policy en español
- [ ] **PRV-02**: AAIP registration del database (Ley 25.326)
- [ ] **PRV-03**: Account deletion flow desde dentro de la app
- [ ] **PRV-04**: Consent dialogs para notificaciones + analytics
- [ ] **PRV-05**: Sin tracking persistente de ubicación

### Tech Foundation

- [ ] **TEC-01**: Cliente Godot 4.3 (iOS + Android)
- [ ] **TEC-02**: Backend Nakama self-hosted en Railway São Paulo
- [ ] **TEC-03**: PostgreSQL via Nakama
- [ ] **TEC-04**: FCM push notifications (v1 API)
- [ ] **TEC-05**: Cloudflare R2 + CDN para assets
- [ ] **TEC-06**: RevenueCat para IAP validation server-side
- [ ] **TEC-07**: GameAnalytics free tier
- [ ] **TEC-08**: GitHub Actions + Fastlane CI/CD
- [ ] **TEC-09**: Server-authoritative para resources, combate, GPS, IAP, season transitions
- [ ] **TEC-10**: Anti-cheat baseline: rate limiting, GPS plausibility, time desde servidor

---

## v1.1 Requirements (depth + retention, post-MVP validation)

- [ ] **V11-01**: Citaciones cara a cara entre barras (combate agendado con countdown público)
- [ ] **V11-02**: Top Boys públicos: top 5 pibes de cada barra con perfil visible
- [ ] **V11-03**: Reputación pública de barra (perfil con Aguante, Respeto, Notoriedad, Trapos, historial)
- [ ] **V11-04**: Metagame comunitario tipo Helldivers: objetivos semanales globales por club
- [ ] **V11-05**: Emotes socialmente cargados anti-club (cosméticos virales)
- [ ] **V11-06**: Mecánica de topo/traición: pibe Buchón filtra info, mini-juego de identificarlo
- [ ] **V11-07**: GPS opt-in: bonus al estar cerca del estadio real día de partido
- [ ] **V11-08**: Anti-spoofing GPS: speed plausibility, IP cross-ref, accuracy threshold
- [ ] **V11-09**: Avatar visual progression: pibe cambia con rango (tatuajes, cicatrices, ropa mejor)
- [ ] **V11-10**: Hitos cinematic personales (primer trapo, primer golpe estado, primer Superclásico ganado)
- [ ] **V11-11**: Eventos especiales clásico/superclásico: doble stake, ventana extendida
- [ ] **V11-12**: Recibimiento colectivo cuando match window abre
- [ ] **V11-13**: Banderazo: evento masivo display de trapos del club

---

## v2 Requirements (ambición — post-validation)

- [ ] **V2-01**: Custom trapo UGC con templates vector + moderación automatizada (Hive / Sightengine)
- [ ] **V2-02**: Viajes de visitante: caravanas al estadio rival con riesgo emboscada en ruta
- [ ] **V2-03**: Persecuciones policiales activas: mini-eventos post-raid
- [ ] **V2-04**: Arco narrativo de temporada (LLM-generado): historia central con eventos progresivos
- [ ] **V2-05**: Caravanas de logística interceptables (sub-juego de robo)
- [ ] **V2-06**: Diplomacia visible (líder + Mesa Chica): pactos, alianzas, traiciones públicas
- [ ] **V2-07**: Última Fecha mega-event: 24hs free-for-all sin ventanas en última jornada AFA
- [ ] **V2-08**: Selección Argentina events: ventana cross-club temporal
- [ ] **V2-09**: Cánticos custom user-recorded (audio UGC + moderación)
- [ ] **V2-10**: Streamer integration (Twitch/Kick overlays)
- [ ] **V2-11**: Libertadores / Sudamericana: clubes extranjeros en eventos especiales

---

## Out of Scope (Permanente)

| Feature | Razón |
|---------|-------|
| Apuestas / gambling con dinero real | Riesgo legal, ético, regulatorio Argentina + stores |
| Violencia gráfica explícita / sangre / armas letales | Store policies + tono caricaturesco |
| Pay-to-Win (stats compradas) | Rompe Core Value y economía competitiva |
| Chat de voz | Moderación inviable solo dev, vector de toxicidad/odio |
| Gacha / loot boxes randomizados | Loot box regulation + Apple/Google policies |
| Modo offline / single-player | Core Value depende del multiplayer |
| Clubes Regional Amateur | Demasiados clubes, fixture data inviable |
| Web/Desktop v1 | Mobile only hasta validar mercado |
| Alianzas permanentes entre clubes rivales | Rompe lore (Boca + River no se alían) |
| Nombres reales de líderes barra existentes | Riesgo legal/defamación |
| Contenido político partidario | Polarización Argentina inviable |
| Tracking persistente de ubicación | Ley 25.326 violation |
| Free text chat (cualquier forma) | Moderación inviable solo dev |

---

## Traceability

| REQ-ID Range | Phase | Phase Name |
|--------------|-------|------------|
| TEC-01..10, ONB-01..04, CLB-01..02, PRV-01..05 | Phase 1 | Foundation |
| CLB-03..05, SEA-01..02, CMB-01, DAY-03 | Phase 2 | Heartbeat AFA |
| AGT-01..05, PIB-01..07, JER-01..04, ONB-05..06 | Phase 3 | Core Loop Laboral |
| CMB-01..10, PIB-08, HEA-01..05, AIB-01..05 | Phase 4 | Combate Estratégico |
| MAP-01..05, SOC-01..06, DAY-01..02, JER-05..07, MOD-01..06 | Phase 5 | Mundo Social |
| MON-01..07, SEA-03..07 | Phase 6 | Monetización + Seasons |
| (refuerzo TEC-09..10 + balance + store + legal) | Phase 7 | Polish + Soft Launch |

**Coverage v1:**
- Total v1 requirements: ~95
- Mapped to phases: 100%
- Unmapped: 0 ✓

---

*Requirements defined: 2026-05-14*
*Last updated: 2026-05-14 after initial definition*
