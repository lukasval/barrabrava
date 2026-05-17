extends PanelContainer

# Reusable chip per UI-SPEC §ClubPickerScreen ChipButton.
# Unselected: bg #2D2D2D, border 1px #3D3D3D, text 14px Bold #A0A0A0, radius 16.
# Selected:   bg #D62828, no border, text 14px Bold #F5F5F5.
# Min touch width 64px, min height 32px.

signal pressed

@export var label_text: String = "" :
	set(v):
		label_text = v
		if is_inside_tree() and _label:
			_label.text = v

@export var is_selected: bool = false :
	set(v):
		is_selected = v
		if is_inside_tree():
			_refresh_style()

var _label: Label
# WR-11 fix: cachear 2 StyleBoxFlat (selected + unselected) en lugar de
# crear uno nuevo en cada _refresh_style — evita basura de GC en cada tap.
var _style_selected: StyleBoxFlat
var _style_unselected: StyleBoxFlat

func _ready() -> void:
	custom_minimum_size = Vector2(64, 32)
	mouse_filter = Control.MOUSE_FILTER_STOP
	_label = $H/Label
	_label.text = label_text
	_refresh_style()

func _build_styles() -> void:
	_style_selected = StyleBoxFlat.new()
	_style_selected.corner_radius_top_left = 16
	_style_selected.corner_radius_top_right = 16
	_style_selected.corner_radius_bottom_left = 16
	_style_selected.corner_radius_bottom_right = 16
	_style_selected.content_margin_left = 8
	_style_selected.content_margin_right = 8
	_style_selected.content_margin_top = 8
	_style_selected.content_margin_bottom = 8
	_style_selected.bg_color = AppTheme.ACCENT
	# no border when selected
	_style_unselected = StyleBoxFlat.new()
	_style_unselected.corner_radius_top_left = 16
	_style_unselected.corner_radius_top_right = 16
	_style_unselected.corner_radius_bottom_left = 16
	_style_unselected.corner_radius_bottom_right = 16
	_style_unselected.content_margin_left = 8
	_style_unselected.content_margin_right = 8
	_style_unselected.content_margin_top = 8
	_style_unselected.content_margin_bottom = 8
	_style_unselected.bg_color = AppTheme.SECONDARY
	_style_unselected.border_width_left = 1
	_style_unselected.border_width_right = 1
	_style_unselected.border_width_top = 1
	_style_unselected.border_width_bottom = 1
	_style_unselected.border_color = AppTheme.BORDER_INACTIVE

func _refresh_style() -> void:
	if _style_selected == null:
		_build_styles()
	add_theme_stylebox_override("panel", _style_selected if is_selected else _style_unselected)
	if _label:
		_label.add_theme_color_override("font_color", AppTheme.TEXT_PRIMARY if is_selected else AppTheme.TEXT_SECONDARY)

func _gui_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch and event.pressed:
		pressed.emit()
	elif event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		pressed.emit()
