extends Node

# Centralized color + spacing tokens — single source of truth for Phase 1 UI.
# Mirrors 01-UI-SPEC.md "Color" and "Spacing Scale" sections.

# Color tokens (UI-SPEC: hex → Godot Color)
const DOMINANT := Color(0.102, 0.102, 0.102, 1)       # #1A1A1A
const SECONDARY := Color(0.176, 0.176, 0.176, 1)      # #2D2D2D
const ACCENT := Color(0.839, 0.157, 0.157, 1)         # #D62828
const DESTRUCTIVE := Color(0.902, 0.494, 0.133, 1)    # #E67E22
const TEXT_PRIMARY := Color(0.961, 0.961, 0.961, 1)   # #F5F5F5
const TEXT_SECONDARY := Color(0.627, 0.627, 0.627, 1) # #A0A0A0
const BORDER_INACTIVE := Color(0.239, 0.239, 0.239, 1)# #3D3D3D
const SURFACE_PRESSED := Color(0.239, 0.239, 0.239, 1)# #3D3D3D

# Spacing tokens (UI-SPEC px multiples of 4)
const SP_XS := 4
const SP_SM := 8
const SP_MD := 16
const SP_LG := 24
const SP_XL := 32
const SP_2XL := 48
const SP_3XL := 64

# Touch target minimum
const TOUCH_MIN := 44

# Typography sizes (UI-SPEC)
const FONT_DISPLAY := 28
const FONT_HEADING := 20  # [OVERRIDE Phase 1] 22 → 20; serves dual Heading + Numeric Counter role per UI-SPEC §3b.
const FONT_BODY := 16
const FONT_LABEL := 14

# Phase 3 — Resource tints (UI-SPEC §4.6)
const RES_PLATA       := Color(0.984, 0.749, 0.141, 1)  # #FBBF24 gold
const RES_AGUANTE     := Color(0.839, 0.157, 0.157, 1)  # #D62828 accent (shared)
const RES_REPUTACION  := Color(0.659, 0.333, 0.969, 1)  # #A855F7 purple
const RES_VBC         := Color(0.580, 0.639, 0.722, 1)  # #94A3B8 steel

# Phase 3 — Rank palette (UI-SPEC §4.2)
const RANK_PIBE     := Color(0.612, 0.639, 0.686, 1)  # #9CA3AF
const RANK_SOLDADO  := Color(0.231, 0.510, 0.965, 1)  # #3B82F6
const RANK_CAPO     := Color(0.659, 0.333, 0.969, 1)  # #A855F7
const RANK_MESA     := Color(0.961, 0.620, 0.043, 1)  # #F59E0B
const RANK_LIDER    := Color(0.984, 0.749, 0.141, 1)  # #FBBF24

# Phase 3 — Profession palette (UI-SPEC §4.3)
const PROF_TRAPITO     := Color(0.024, 0.714, 0.831, 1)  # #06B6D4
const PROF_VENDEDOR    := Color(0.133, 0.773, 0.369, 1)  # #22C55E
const PROF_PATOVICA    := Color(0.937, 0.267, 0.267, 1)  # #EF4444
const PROF_REMISERO    := Color(0.918, 0.702, 0.031, 1)  # #EAB308
const PROF_HABLAR_CANA := Color(0.580, 0.639, 0.722, 1)  # #94A3B8
const PROF_SIN_LABURO  := Color(0.239, 0.239, 0.239, 1)  # #3D3D3D

# Phase 3 — Trait sentiment border (UI-SPEC §4.4)
const TRAIT_POSITIVE := Color(0.063, 0.725, 0.506, 1)  # #10B981
const TRAIT_NEGATIVE := Color(0.976, 0.451, 0.086, 1)  # #F97316
const TRAIT_NEUTRAL  := Color(0.239, 0.239, 0.239, 1)  # #3D3D3D

# Phase 3 — Energía bar thresholds (UI-SPEC §4.5, D-04)
const ENERGIA_FULL  := Color(0.133, 0.773, 0.369, 1)  # #22C55E (70-100)
const ENERGIA_MID   := Color(0.918, 0.702, 0.031, 1)  # #EAB308 (30-69)
const ENERGIA_LOW   := Color(0.976, 0.451, 0.086, 1)  # #F97316 (1-29)
const ENERGIA_EMPTY := Color(0.627, 0.627, 0.627, 1)  # #A0A0A0 (0)

# Safe area (filled at boot)
var safe_area_top: int = 0
var safe_area_bottom: int = 34  # iOS home indicator min

const THEME_PATH := "res://assets/theme/Theme.tres"

func _ready() -> void:
	var rect = DisplayServer.get_display_safe_area()
	var screen_size = DisplayServer.screen_get_size()
	safe_area_top = max(0, rect.position.y)
	safe_area_bottom = max(34, screen_size.y - rect.position.y - rect.size.y)
	print("[AppTheme] safe_area top=%d bottom=%d" % [safe_area_top, safe_area_bottom])
	# WR-10 fix: Theme.tres carga 2 FontFile (Nunito Regular + Bold) que en
	# mobile pueden bloquear el main thread 50-300ms con load() síncrono.
	# Usamos load_threaded_request + check en _process. Las screens ya tienen
	# fallback styles (theme_override_stylebox), así que el primer frame es OK
	# sin tema y se aplica cuando termina la carga.
	if ResourceLoader.exists(THEME_PATH):
		ResourceLoader.load_threaded_request(THEME_PATH)
		set_process(true)
	else:
		push_warning("[AppTheme] Theme.tres not found at boot (deferred until imports complete)")
		set_process(false)

# Phase 3 — Resource-tint lookup helper (used by ResourceWidget).
func get_resource_color(name: String) -> Color:
	match name:
		"plata":      return RES_PLATA
		"aguante":    return RES_AGUANTE
		"reputacion": return RES_REPUTACION
		"vbc":        return RES_VBC
		_:            return TEXT_PRIMARY

# Phase 3 — Energía threshold lookup (used by EnergiaBar). D-04.
func get_energia_color(value: int) -> Color:
	if value <= 0: return ENERGIA_EMPTY
	if value < 30: return ENERGIA_LOW
	if value < 70: return ENERGIA_MID
	return ENERGIA_FULL

func _process(_dt: float) -> void:
	var status = ResourceLoader.load_threaded_get_status(THEME_PATH)
	if status == ResourceLoader.THREAD_LOAD_LOADED:
		var t := ResourceLoader.load_threaded_get(THEME_PATH) as Theme
		if t:
			get_tree().root.theme = t
			print("[AppTheme] global theme applied (threaded)")
		else:
			push_warning("[AppTheme] Theme.tres load returned null")
		set_process(false)
	elif status == ResourceLoader.THREAD_LOAD_FAILED or status == ResourceLoader.THREAD_LOAD_INVALID_RESOURCE:
		push_warning("[AppTheme] Theme.tres failed to load threaded")
		set_process(false)
