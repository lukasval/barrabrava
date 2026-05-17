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

func _ready() -> void:
	custom_minimum_size = Vector2(64, 32)
	mouse_filter = Control.MOUSE_FILTER_STOP
	_label = $H/Label
	_label.text = label_text
	_refresh_style()

func _refresh_style() -> void:
	var sb := StyleBoxFlat.new()
	sb.corner_radius_top_left = 16
	sb.corner_radius_top_right = 16
	sb.corner_radius_bottom_left = 16
	sb.corner_radius_bottom_right = 16
	sb.content_margin_left = 8
	sb.content_margin_right = 8
	sb.content_margin_top = 8
	sb.content_margin_bottom = 8
	if is_selected:
		sb.bg_color = AppTheme.ACCENT
		sb.border_width_left = 0
		sb.border_width_right = 0
		sb.border_width_top = 0
		sb.border_width_bottom = 0
		if _label:
			_label.add_theme_color_override("font_color", AppTheme.TEXT_PRIMARY)
	else:
		sb.bg_color = AppTheme.SECONDARY
		sb.border_width_left = 1
		sb.border_width_right = 1
		sb.border_width_top = 1
		sb.border_width_bottom = 1
		sb.border_color = AppTheme.BORDER_INACTIVE
		if _label:
			_label.add_theme_color_override("font_color", AppTheme.TEXT_SECONDARY)
	add_theme_stylebox_override("panel", sb)

func _gui_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch and event.pressed:
		pressed.emit()
	elif event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		pressed.emit()
