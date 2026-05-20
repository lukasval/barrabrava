extends PanelContainer

# Reusable rank badge per UI-SPEC §6.4.
# PanelContainer corner 12, padding 8h/4v. Label 14 Bold all-caps.
# set_rank(name) setter swaps cached StyleBoxFlat from AppTheme rank palette.
# Promotion flash: 1.2s scale tween 1.0→1.15→1.0 + accent border 2px (D-13 hook).

@onready var _label: Label = $RankLabel

var _style_cache: Dictionary = {}  # rank_name -> StyleBoxFlat

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_build_styles()
	set_rank("pibe")

func _build_styles() -> void:
	var ranks := {
		"pibe":    AppTheme.RANK_PIBE,
		"soldado": AppTheme.RANK_SOLDADO,
		"capo":    AppTheme.RANK_CAPO,
		"mesa":    AppTheme.RANK_MESA,
		"lider":   AppTheme.RANK_LIDER,
	}
	for rname in ranks:
		var sb = StyleBoxFlat.new()
		sb.bg_color = ranks[rname]
		sb.corner_radius_top_left = 12
		sb.corner_radius_top_right = 12
		sb.corner_radius_bottom_left = 12
		sb.corner_radius_bottom_right = 12
		sb.content_margin_left = 8
		sb.content_margin_right = 8
		sb.content_margin_top = 4
		sb.content_margin_bottom = 4
		_style_cache[rname] = sb

func set_rank(name: String) -> void:
	var key = name.to_lower()
	if not _style_cache.has(key):
		key = "pibe"
	add_theme_stylebox_override("panel", _style_cache[key])
	if _label:
		# D-14 Mesa label; D-16 rank labels in lunfardo
		match key:
			"pibe":    _label.text = "PIBE"
			"soldado": _label.text = "SOLDADO"
			"capo":    _label.text = "CAPO"
			"mesa":    _label.text = "MESA"
			"lider":   _label.text = "LIDER"
			_:         _label.text = name.to_upper()

# Promotion flash hook (D-13 / animation A-07).
# Called by HomeScreen or RosterScreen on rank-up event.
func play_promotion_flash() -> void:
	var t = create_tween()
	t.tween_property(self, "scale", Vector2(1.15, 1.15), 0.3)
	t.tween_property(self, "scale", Vector2(1.0, 1.0), 0.9)
	# Accent border flash
	var sb_flash = _style_cache.get("pibe", StyleBoxFlat.new()).duplicate() as StyleBoxFlat
	sb_flash.border_width_left = 2
	sb_flash.border_width_right = 2
	sb_flash.border_width_top = 2
	sb_flash.border_width_bottom = 2
	sb_flash.border_color = AppTheme.ACCENT
	add_theme_stylebox_override("panel", sb_flash)
	await get_tree().create_timer(1.2).timeout
	# Restore proper rank style after flash
	var current_text = _label.text.to_lower() if _label else "pibe"
	set_rank(current_text)
