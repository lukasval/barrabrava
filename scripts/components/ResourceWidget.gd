extends VBoxContainer

# Reusable resource widget per UI-SPEC §6.3.
# VBoxContainer 80×60 fixed. HBox: 24×24 ColorRect tile (tinted) + one-letter glyph Label.
# Plus 20px Bold NumericValue Label below.
# set_value(int) setter formats with '.' thousands separator (Spanish locale per UI-SPEC §3b).
# tooltip_text set for accessibility ("Plata: {N}").
# resource_name drives glyph and tint via AppTheme.get_resource_color.

@export var resource_name: String = "plata" :
	set(v):
		resource_name = v
		if is_inside_tree():
			_refresh_tint()

@onready var _tint: ColorRect = $GlyphRow/Tint
@onready var _glyph: Label = $GlyphRow/Glyph
@onready var _value_label: Label = $ValueLabel

var _raw_value: int = 0

# Glyph map — single-letter per resource (fallback until icons ship)
const GLYPH_MAP := {
	"plata":      "$",
	"aguante":    "A",
	"reputacion": "R",
	"vbc":        "V",
}

func _ready() -> void:
	custom_minimum_size = Vector2(80, 60)
	size_flags_horizontal = SIZE_SHRINK_CENTER
	_refresh_tint()
	_refresh_value()

func _refresh_tint() -> void:
	var color = AppTheme.get_resource_color(resource_name)
	if _tint:
		_tint.color = color
	if _glyph:
		_glyph.text = GLYPH_MAP.get(resource_name, "?")
		_glyph.add_theme_color_override("font_color", color)

func set_value(val: int) -> void:
	_raw_value = val
	_refresh_value()
	tooltip_text = _resource_display_name() + ": " + _format_number(val)

func _refresh_value() -> void:
	if _value_label:
		_value_label.text = _format_number(_raw_value)

func _resource_display_name() -> String:
	match resource_name:
		"plata":      return "Plata"
		"aguante":    return "Aguante"
		"reputacion": return "Reputación"
		"vbc":        return "Visto Bueno Cana"
		_:            return resource_name.capitalize()

# Spanish locale thousands separator: '.' (e.g. 1250 → "1.250")
func _format_number(val: int) -> String:
	var s = str(val)
	var result := ""
	var count := 0
	for i in range(s.length() - 1, -1, -1):
		if count > 0 and count % 3 == 0:
			result = "." + result
		result = s[i] + result
		count += 1
	return result
