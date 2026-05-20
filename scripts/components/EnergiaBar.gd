extends ProgressBar

# Reusable energía bar per UI-SPEC §6.5.
# ProgressBar tinted by AppTheme.get_energia_color; regular + mini variants.
# Regular: 16px height. Mini: 8px height (used inside PibeCard).
# Track bg #2D2D2D. Fill color switches at integer thresholds 0/30/70 (D-04).

@export var mini: bool = false :
	set(v):
		mini = v
		if is_inside_tree():
			_apply_size()

var _fill_style: StyleBoxFlat
var _track_style: StyleBoxFlat

func _ready() -> void:
	show_percentage = false
	min_value = 0.0
	max_value = 100.0
	_build_styles()
	_apply_size()
	_refresh_fill()

func _build_styles() -> void:
	_track_style = StyleBoxFlat.new()
	_track_style.bg_color = Color(0.176, 0.176, 0.176, 1)  # #2D2D2D
	_track_style.corner_radius_top_left = 4
	_track_style.corner_radius_top_right = 4
	_track_style.corner_radius_bottom_left = 4
	_track_style.corner_radius_bottom_right = 4
	add_theme_stylebox_override("background", _track_style)
	_fill_style = StyleBoxFlat.new()
	_fill_style.corner_radius_top_left = 4
	_fill_style.corner_radius_top_right = 4
	_fill_style.corner_radius_bottom_left = 4
	_fill_style.corner_radius_bottom_right = 4
	add_theme_stylebox_override("fill", _fill_style)

func _apply_size() -> void:
	custom_minimum_size.y = 8 if mini else 16

func _refresh_fill() -> void:
	if _fill_style == null:
		return
	_fill_style.bg_color = AppTheme.get_energia_color(int(value))
	add_theme_stylebox_override("fill", _fill_style)

func set_energia(val: int) -> void:
	value = clampf(float(val), 0.0, 100.0)
	_refresh_fill()
