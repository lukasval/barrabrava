extends PanelContainer

# Reusable club card per UI-SPEC §ClubPickerScreen ClubCard.
# PanelContainer with [Crest ColorRect 40x40] + [VBox: Name 16px Bold + Division 14px Regular].

signal tapped

@onready var crest: ColorRect = $H/Crest
@onready var name_label: Label = $H/V/Name
@onready var division_label: Label = $H/V/Division

var club_data: Dictionary = {}

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP
	custom_minimum_size.y = 64

func set_club(club: Dictionary) -> void:
	club_data = club
	name_label.text = str(club.get("lunfardo_name", ""))
	division_label.text = str(club.get("division", ""))
	var colors = club.get("colors", {})
	var primary_hex = str(colors.get("primary", "#888888"))
	crest.color = Color(primary_hex)

func set_selected(sel: bool) -> void:
	var base := get_theme_stylebox("panel")
	var sb: StyleBoxFlat
	if base is StyleBoxFlat:
		sb = (base as StyleBoxFlat).duplicate() as StyleBoxFlat
	else:
		sb = StyleBoxFlat.new()
		sb.bg_color = AppTheme.SECONDARY
		sb.corner_radius_top_left = 8
		sb.corner_radius_top_right = 8
		sb.corner_radius_bottom_left = 8
		sb.corner_radius_bottom_right = 8
		sb.content_margin_left = 16
		sb.content_margin_right = 16
		sb.content_margin_top = 16
		sb.content_margin_bottom = 16
	sb.border_width_left = 2 if sel else 0
	sb.border_width_top = 2 if sel else 0
	sb.border_width_right = 2 if sel else 0
	sb.border_width_bottom = 2 if sel else 0
	sb.border_color = AppTheme.ACCENT
	add_theme_stylebox_override("panel", sb)

func _gui_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch and event.pressed:
		tapped.emit()
	elif event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		tapped.emit()
