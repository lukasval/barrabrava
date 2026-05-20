extends Control

# Reusable skill progress ring per UI-SPEC §6.6.
# 40×40 Control with _draw() override calling draw_arc().
# Background ring stroke #3D3D3D, foreground stroke #FBBF24 (RES_PLATA gold), 4px width.
# Center Label 16px Bold for level number.

@export var level: int = 0 :
	set(v):
		level = clampi(v, 0, 99)
		if is_inside_tree():
			queue_redraw()
			_update_label()

@export var max_level: int = 10 :
	set(v):
		max_level = maxi(v, 1)
		if is_inside_tree():
			queue_redraw()

@onready var _level_label: Label = $LevelLabel

const RING_WIDTH := 4.0
const COLOR_TRACK := Color(0.239, 0.239, 0.239, 1)   # #3D3D3D
const COLOR_FILL  := Color(0.984, 0.749, 0.141, 1)   # #FBBF24 (RES_PLATA)

func _ready() -> void:
	custom_minimum_size = Vector2(40, 40)
	_update_label()

func _draw() -> void:
	var center := size / 2.0
	var radius := (minf(size.x, size.y) / 2.0) - RING_WIDTH
	# Background full ring
	draw_arc(center, radius, 0.0, TAU, 64, COLOR_TRACK, RING_WIDTH, true)
	# Foreground arc proportional to level/max_level
	if max_level > 0 and level > 0:
		var frac := clampf(float(level) / float(max_level), 0.0, 1.0)
		# Start from top (-PI/2), go clockwise
		var start_angle := -PI / 2.0
		var end_angle := start_angle + frac * TAU
		draw_arc(center, radius, start_angle, end_angle, 64, COLOR_FILL, RING_WIDTH, true)

func _update_label() -> void:
	if _level_label:
		_level_label.text = str(level)

func set_level_data(current_level: int, max_lv: int = 10) -> void:
	max_level = max_lv
	level = current_level
