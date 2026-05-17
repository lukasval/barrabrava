extends VBoxContainer

# Bottom nav button per UI-SPEC §HomeScreen NavButton.
# VBox: [Dot 4x4 active indicator] + [Icon placeholder 24x24] + [Label 14px Bold].

signal tapped

@export var label_text: String = "" :
	set(v):
		label_text = v
		if is_inside_tree() and _label:
			_label.text = v

@export var is_active: bool = false :
	set(v):
		is_active = v
		if is_inside_tree():
			_refresh()

var _dot: ColorRect
var _icon: ColorRect
var _label: Label

func _ready() -> void:
	custom_minimum_size = Vector2(64, 56)
	mouse_filter = Control.MOUSE_FILTER_STOP
	alignment = BoxContainer.ALIGNMENT_CENTER
	_dot = $Dot
	_icon = $Icon
	_label = $Label
	_label.text = label_text
	_refresh()

func _refresh() -> void:
	if _dot == null:
		return
	_dot.visible = is_active
	_dot.color = AppTheme.ACCENT
	_icon.color = AppTheme.TEXT_PRIMARY if is_active else AppTheme.TEXT_SECONDARY
	_label.add_theme_color_override("font_color", AppTheme.TEXT_PRIMARY if is_active else AppTheme.TEXT_SECONDARY)

func _gui_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch and event.pressed:
		tapped.emit()
	elif event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		tapped.emit()
