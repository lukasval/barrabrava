extends PanelContainer

# Reusable pibe card per UI-SPEC §6.1.
# PanelContainer 120px height. HBox: [80×80 AvatarPlaceholder] + [VBox info].
# VBox: [HBox Name+RankBadge] + [Rol/Profesión label] + [EnergiaBar mini] + [HBox TraitChip×2].
# set_pibe(Dictionary) setter — mirrors ClubCard.set_club pattern.
# tapped(pibe_id) signal.
# In-turno state: left-edge 4px accent stripe.

signal tapped(pibe_id)

@onready var _avatar: ColorRect = $H/Avatar
@onready var _name_label: Label = $H/V/NameRow/PibeName
@onready var _rank_badge: PanelContainer = $H/V/NameRow/RankBadge
@onready var _rol_label: Label = $H/V/RolLabel
@onready var _energia_bar: ProgressBar = $H/V/EnergiaBar
@onready var _trait1: PanelContainer = $H/V/Traits/Trait1
@onready var _trait2: PanelContainer = $H/V/Traits/Trait2
@onready var _turno_stripe: ColorRect = $TurnoStripe

var _pibe_data: Dictionary = {}

var _style_normal: StyleBoxFlat
var _style_turno: StyleBoxFlat

func _ready() -> void:
	custom_minimum_size.y = 120
	mouse_filter = Control.MOUSE_FILTER_STOP
	_build_styles()
	_apply_normal_style()

func _build_styles() -> void:
	_style_normal = StyleBoxFlat.new()
	_style_normal.bg_color = AppTheme.SECONDARY
	_style_normal.corner_radius_top_left = 8
	_style_normal.corner_radius_top_right = 8
	_style_normal.corner_radius_bottom_left = 8
	_style_normal.corner_radius_bottom_right = 8
	_style_normal.content_margin_left = 12
	_style_normal.content_margin_right = 12
	_style_normal.content_margin_top = 8
	_style_normal.content_margin_bottom = 8
	_style_turno = _style_normal.duplicate() as StyleBoxFlat
	_style_turno.border_width_left = 4
	_style_turno.border_color = AppTheme.ACCENT

func _apply_normal_style() -> void:
	add_theme_stylebox_override("panel", _style_normal)
	if _turno_stripe:
		_turno_stripe.visible = false

func set_pibe(pibe: Dictionary) -> void:
	_pibe_data = pibe
	# Name — AI / Líder slots may have null display_name; render fallback lunfardo
	var raw_name = pibe.get("display_name", null)
	var slot_num = str(pibe.get("slot", ""))
	var show_name: String
	if raw_name == null or str(raw_name) == "":
		show_name = "Capo de la Barra" + (" #" + slot_num if slot_num != "" else "")
	else:
		show_name = str(raw_name)
	if _name_label:
		_name_label.text = show_name

	# Rank badge
	var rank_str = str(pibe.get("rank", "pibe")).to_lower()
	if _rank_badge and _rank_badge.has_method("set_rank"):
		_rank_badge.set_rank(rank_str)

	# Rol / profesión label
	var profession = pibe.get("profession", null)
	var rol = str(pibe.get("rol", ""))
	var rol_text: String
	if profession != null and str(profession) != "" and str(profession) != "null":
		rol_text = str(profession).replace("_", " ").capitalize()
	elif rol != "":
		rol_text = rol.replace("_", " ").capitalize()
	else:
		rol_text = "Sin laburo"
	if _rol_label:
		_rol_label.text = rol_text

	# Energía bar (mini)
	var energia = int(pibe.get("energia", 100))
	if _energia_bar:
		_energia_bar.value = energia
		var fill_sb = StyleBoxFlat.new()
		fill_sb.bg_color = AppTheme.get_energia_color(energia)
		_energia_bar.add_theme_stylebox_override("fill", fill_sb)
		var track_sb = StyleBoxFlat.new()
		track_sb.bg_color = Color(0.176, 0.176, 0.176, 1)  # #2D2D2D
		_energia_bar.add_theme_stylebox_override("background", track_sb)

	# Avatar color (placeholder — tinted with club color or neutral)
	if _avatar:
		var club_color = str(pibe.get("club_color", "#888888"))
		_avatar.color = Color(club_color)

	# Traits
	var traits = pibe.get("traits", [])
	var t1 = traits[0] if traits.size() > 0 else {}
	var t2 = traits[1] if traits.size() > 1 else {}
	if _trait1 and _trait1.has_method("set_trait"):
		_trait1.set_trait(
			str(t1.get("id", "")),
			str(t1.get("sentiment", "neutral")),
			str(t1.get("label", ""))
		)
		_trait1.visible = t1.size() > 0
	if _trait2 and _trait2.has_method("set_trait"):
		_trait2.set_trait(
			str(t2.get("id", "")),
			str(t2.get("sentiment", "neutral")),
			str(t2.get("label", ""))
		)
		_trait2.visible = t2.size() > 0

	# En-turno state
	var en_turno = bool(pibe.get("en_turno", false))
	if en_turno:
		add_theme_stylebox_override("panel", _style_turno)
		if _turno_stripe:
			_turno_stripe.visible = true
	else:
		_apply_normal_style()

func _gui_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch and event.pressed:
		tapped.emit(str(_pibe_data.get("id", "")))
	elif event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		tapped.emit(str(_pibe_data.get("id", "")))
