extends PanelContainer

# Reusable profession icon per UI-SPEC §6.8.
# PanelContainer 24×24 (inline) or 40×40 (assign screen rows).
# Bg color from AppTheme PROF_* palette. Inner ColorRect placeholder for monochrome icon.
# set_profession(name) setter. Two size variants via 'large' export.

@export var large: bool = false :
	set(v):
		large = v
		if is_inside_tree():
			_apply_size()

@onready var _icon_rect: ColorRect = $IconRect

var _style: StyleBoxFlat

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_style = StyleBoxFlat.new()
	_style.corner_radius_top_left = 6
	_style.corner_radius_top_right = 6
	_style.corner_radius_bottom_left = 6
	_style.corner_radius_bottom_right = 6
	_style.content_margin_left = 4
	_style.content_margin_right = 4
	_style.content_margin_top = 4
	_style.content_margin_bottom = 4
	_style.bg_color = AppTheme.PROF_SIN_LABURO
	add_theme_stylebox_override("panel", _style)
	_apply_size()

func _apply_size() -> void:
	var sz = 40 if large else 24
	custom_minimum_size = Vector2(sz, sz)

func set_profession(profession_name: String) -> void:
	var color := _get_profession_color(profession_name)
	_style.bg_color = color
	add_theme_stylebox_override("panel", _style)
	if _icon_rect:
		_icon_rect.color = Color(color.r * 1.3, color.g * 1.3, color.b * 1.3, 0.5).clamp()

func _get_profession_color(name: String) -> Color:
	match name.to_lower():
		"trapito":     return AppTheme.PROF_TRAPITO
		"vendedor":    return AppTheme.PROF_VENDEDOR
		"patovica":    return AppTheme.PROF_PATOVICA
		"remisero":    return AppTheme.PROF_REMISERO
		"hablar_cana": return AppTheme.PROF_HABLAR_CANA
		_:             return AppTheme.PROF_SIN_LABURO
