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
const FONT_HEADING := 22
const FONT_BODY := 16
const FONT_LABEL := 14

# Safe area (filled at boot)
var safe_area_top: int = 0
var safe_area_bottom: int = 34  # iOS home indicator min

func _ready() -> void:
	var rect = DisplayServer.get_display_safe_area()
	var screen_size = DisplayServer.screen_get_size()
	safe_area_top = max(0, rect.position.y)
	safe_area_bottom = max(34, screen_size.y - rect.position.y - rect.size.y)
	print("[AppTheme] safe_area top=%d bottom=%d" % [safe_area_top, safe_area_bottom])
	# Load global theme at runtime (avoids boot-time chicken-and-egg with font imports in CI)
	if ResourceLoader.exists("res://assets/theme/Theme.tres"):
		var t := load("res://assets/theme/Theme.tres") as Theme
		if t:
			get_tree().root.theme = t
			print("[AppTheme] global theme applied")
		else:
			push_warning("[AppTheme] Theme.tres load returned null")
	else:
		push_warning("[AppTheme] Theme.tres not found at boot (deferred until imports complete)")
