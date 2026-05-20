extends PanelContainer

# Reusable recruit card per UI-SPEC §6.2.
# PanelContainer 180px. HBox: [120×140 AvatarLarge] + [VBox info].
# VBox: Name (Display 28), RolLabel, HBox [TraitChip visible + TraitChip hidden "?"], Plata cost, Reclutar button.
# Gated state (rank insufficient): modulate.a = 0.4 + disabled CTA + gate label.
# D-10: trait_2 always rendered as "?" pre-recruit.

signal pick_selected(pick_id)

@onready var _avatar: ColorRect = $H/AvatarLarge
@onready var _name_label: Label = $H/V/PibeName
@onready var _rol_label: Label = $H/V/RolLabel
@onready var _trait1: PanelContainer = $H/V/Traits/Trait1
@onready var _trait2_hidden: PanelContainer = $H/V/Traits/Trait2Hidden
@onready var _cost_label: Label = $H/V/CostLabel
@onready var _gate_label: Label = $H/V/GateLabel
@onready var _recruit_btn: Button = $H/V/RecruitBtn

var _pick_data: Dictionary = {}

var _style_normal: StyleBoxFlat
var _style_gated: StyleBoxFlat

func _ready() -> void:
	custom_minimum_size.y = 180
	_build_styles()
	add_theme_stylebox_override("panel", _style_normal)
	if _recruit_btn:
		_recruit_btn.pressed.connect(_on_recruit_pressed)
	if _gate_label:
		_gate_label.visible = false

func _build_styles() -> void:
	_style_normal = StyleBoxFlat.new()
	_style_normal.bg_color = AppTheme.SECONDARY
	_style_normal.corner_radius_top_left = 8
	_style_normal.corner_radius_top_right = 8
	_style_normal.corner_radius_bottom_left = 8
	_style_normal.corner_radius_bottom_right = 8
	_style_normal.content_margin_left = 12
	_style_normal.content_margin_right = 12
	_style_normal.content_margin_top = 12
	_style_normal.content_margin_bottom = 12
	_style_gated = _style_normal.duplicate() as StyleBoxFlat
	_style_gated.bg_color = Color(AppTheme.SECONDARY.r, AppTheme.SECONDARY.g, AppTheme.SECONDARY.b, 0.4)

# set_pick populates the card from a recruit pool pick dict.
# Expected fields: id, display_name, rol, trait_1{id,sentiment,label}, plata_cost, rank_required.
# trait_2 is always hidden as "?" per D-10.
func set_pick(pick: Dictionary) -> void:
	_pick_data = pick

	# Name
	if _name_label:
		_name_label.text = str(pick.get("display_name", "???"))

	# Rol
	if _rol_label:
		var rol = str(pick.get("rol", "")).replace("_", " ").capitalize()
		_rol_label.text = rol

	# Avatar
	if _avatar:
		_avatar.color = Color(str(pick.get("club_color", "#555555")))

	# Trait 1 (visible)
	var t1 = pick.get("trait_1", {})
	if _trait1 and _trait1.has_method("set_trait"):
		_trait1.set_trait(
			str(t1.get("id", "")),
			str(t1.get("sentiment", "neutral")),
			str(t1.get("label", ""))
		)

	# Trait 2 always hidden as "?" (D-10)
	if _trait2_hidden and _trait2_hidden.has_method("set_trait"):
		_trait2_hidden.set_trait("", "", "")  # triggers hidden variant

	# Cost label
	var cost = int(pick.get("plata_cost", 500))
	if _cost_label:
		_cost_label.text = "Costo: $" + str(cost) + " Plata"

	# Gating: rank_required vs PlayerStore.rank
	var rank_req = str(pick.get("rank_required", "pibe")).to_lower()
	var player_rank = PlayerStore.rank.to_lower()
	var is_gated = not _rank_meets(player_rank, rank_req)
	_set_gated(is_gated, rank_req)

func _rank_meets(player: String, required: String) -> bool:
	const ORDER := ["pibe", "soldado", "capo", "mesa", "lider"]
	var p_idx = ORDER.find(player)
	var r_idx = ORDER.find(required)
	if p_idx < 0: p_idx = 0
	if r_idx < 0: r_idx = 0
	return p_idx >= r_idx

func _set_gated(gated: bool, rank_req: String) -> void:
	if gated:
		modulate.a = 0.4
		add_theme_stylebox_override("panel", _style_gated)
		if _recruit_btn:
			_recruit_btn.disabled = true
		if _gate_label:
			_gate_label.visible = true
			_gate_label.text = "Requiere rango: " + rank_req.capitalize()
	else:
		modulate.a = 1.0
		add_theme_stylebox_override("panel", _style_normal)
		if _recruit_btn:
			_recruit_btn.disabled = false
		if _gate_label:
			_gate_label.visible = false

func _on_recruit_pressed() -> void:
	if _recruit_btn:
		_recruit_btn.disabled = true
	pick_selected.emit(str(_pick_data.get("id", "")))
