extends PanelContainer

# Reusable trait chip per UI-SPEC §6.7.
# PanelContainer corner 14, border 1px from AppTheme TRAIT_POSITIVE/NEGATIVE/NEUTRAL.
# Label 14 Bold. set_trait(id, sentiment, label) setter.
# Hidden variant: label "?" + modulate 0.6 + border #3D3D3D.

@onready var _label: Label = $TraitLabel

var _style_positive: StyleBoxFlat
var _style_negative: StyleBoxFlat
var _style_neutral: StyleBoxFlat
var _style_hidden: StyleBoxFlat

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_build_styles()

func _build_styles() -> void:
	_style_positive = _make_style(AppTheme.TRAIT_POSITIVE)
	_style_negative = _make_style(AppTheme.TRAIT_NEGATIVE)
	_style_neutral  = _make_style(AppTheme.TRAIT_NEUTRAL)
	_style_hidden   = _make_style(AppTheme.BORDER_INACTIVE)

func _make_style(border_color: Color) -> StyleBoxFlat:
	var sb = StyleBoxFlat.new()
	sb.bg_color = AppTheme.SECONDARY
	sb.corner_radius_top_left = 14
	sb.corner_radius_top_right = 14
	sb.corner_radius_bottom_left = 14
	sb.corner_radius_bottom_right = 14
	sb.border_width_left = 1
	sb.border_width_right = 1
	sb.border_width_top = 1
	sb.border_width_bottom = 1
	sb.border_color = border_color
	sb.content_margin_left = 8
	sb.content_margin_right = 8
	sb.content_margin_top = 4
	sb.content_margin_bottom = 4
	return sb

func set_trait(id: String, sentiment: String, label: String) -> void:
	if id == "" and label == "":
		# Hidden variant (D-10: trait_2 not yet revealed)
		add_theme_stylebox_override("panel", _style_hidden)
		modulate.a = 0.6
		if _label:
			_label.text = "?"
		return
	modulate.a = 1.0
	if _label:
		_label.text = label if label != "" else id
	match sentiment.to_lower():
		"positive":
			add_theme_stylebox_override("panel", _style_positive)
		"negative":
			add_theme_stylebox_override("panel", _style_negative)
		_:
			add_theme_stylebox_override("panel", _style_neutral)
