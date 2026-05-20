extends Control

# RosterScreen — scrollable list of player's pibes.
# UI-SPEC §5.2. Sort chips + PibeCard pool + empty/loading/error states.
# T-3-UIB-09: CTA disabled-during-RPC pattern via _loading flag.

@onready var back_button: Button = $TopBar/BackButton
@onready var title_label: Label = $TopBar/Title
@onready var roster_count: Label = $TopBar/RosterCount
@onready var chips_box: HBoxContainer = $SortChips
@onready var scroll: ScrollContainer = $ScrollContainer
@onready var list_box: VBoxContainer = $ScrollContainer/VBox
@onready var empty_state: VBoxContainer = $EmptyState
@onready var loading_state: VBoxContainer = $LoadingState
@onready var error_state: VBoxContainer = $ErrorState
@onready var error_label: Label = $ErrorState/ErrorLabel
@onready var retry_button: Button = $ErrorState/RetryButton
@onready var recruit_hint_btn: Button = $EmptyState/RecruitBtn

@onready var nav_inicio: Node = $BottomNav/NavInicio
@onready var nav_roster: Node = $BottomNav/NavRoster
@onready var nav_aguantadero: Node = $BottomNav/NavAguantadero
@onready var nav_reclutar: Node = $BottomNav/NavReclutar

const SORT_OPTIONS := ["Por Rep", "Por Energía", "Por Rol"]
const PibeCardScene = preload("res://scenes/components/PibeCard.tscn")

var _current_sort := "Por Rep"
var _card_pool: Array = []
var _sorted_pibes: Array = []
var _loading := false

func _ready() -> void:
	title_label.text = "Mis pibes"
	back_button.text = "‹ Atrás"
	back_button.pressed.connect(func(): FlowRouter.go_home())
	retry_button.pressed.connect(_load_roster)
	if recruit_hint_btn:
		recruit_hint_btn.pressed.connect(func(): FlowRouter.go_recruit())

	# BottomNav connections.
	if nav_inicio and nav_inicio.has_signal("tapped"):
		nav_inicio.tapped.connect(func(): FlowRouter.go_home())
	if nav_roster and nav_roster.has_signal("tapped"):
		nav_roster.tapped.connect(func(): pass)  # already here
	if nav_aguantadero and nav_aguantadero.has_signal("tapped"):
		nav_aguantadero.tapped.connect(func(): FlowRouter.go_aguantadero())
	if nav_reclutar and nav_reclutar.has_signal("tapped"):
		nav_reclutar.tapped.connect(func(): FlowRouter.go_recruit())

	_build_sort_chips()
	_show_loading()
	await _load_roster()

func _build_sort_chips() -> void:
	# Use ChipButton instances for sort selection.
	const ChipScene = preload("res://scenes/components/ChipButton.tscn")
	for opt in SORT_OPTIONS:
		var chip = ChipScene.instantiate()
		chip.label_text = opt
		chip.is_selected = (opt == _current_sort)
		chip.pressed.connect(_on_chip_pressed.bind(opt, chip))
		chips_box.add_child(chip)

func _on_chip_pressed(opt: String, chip: Node) -> void:
	_current_sort = opt
	for c in chips_box.get_children():
		c.is_selected = (c == chip)
	_render_pibes()

func _show_loading() -> void:
	scroll.visible = false
	empty_state.visible = false
	error_state.visible = false
	loading_state.visible = true

func _show_error(msg: String) -> void:
	scroll.visible = false
	empty_state.visible = false
	loading_state.visible = false
	error_state.visible = true
	error_label.text = msg

func _load_roster() -> void:
	if _loading:
		return
	_loading = true
	_show_loading()
	var resp = await NakamaService.get_roster()
	_loading = false
	if not resp.get("ok", false):
		_show_error("No pudimos cargar tu roster. Probá de nuevo.")
		return
	var data = resp.get("data", {})
	PlayerStore.pibes = data.get("pibes", [])
	PlayerStore.roster_cap = int(data.get("roster_cap", 5))
	PlayerStore.rank = str(data.get("rank", "pibe"))
	PlayerStore.roster_updated.emit()
	_render_pibes()

func _render_pibes() -> void:
	loading_state.visible = false
	error_state.visible = false

	var pibes = PlayerStore.pibes.duplicate()

	if pibes.is_empty():
		scroll.visible = false
		empty_state.visible = true
		roster_count.text = "0/%d" % PlayerStore.roster_cap
		return

	# Sort pibes.
	match _current_sort:
		"Por Rep":
			pibes.sort_custom(func(a, b): return int(a.get("reputacion", 0)) > int(b.get("reputacion", 0)))
		"Por Energía":
			pibes.sort_custom(func(a, b): return int(a.get("energia", 0)) > int(b.get("energia", 0)))
		"Por Rol":
			pibes.sort_custom(func(a, b): return str(a.get("profession", "")) < str(b.get("profession", "")))

	_sorted_pibes = pibes
	scroll.visible = true
	empty_state.visible = false
	roster_count.text = "%d/%d" % [pibes.size(), PlayerStore.roster_cap]

	# Grow pool if needed.
	while _card_pool.size() < pibes.size():
		var card = PibeCardScene.instantiate()
		list_box.add_child(card)
		card.tapped.connect(_on_card_tapped)
		_card_pool.append(card)

	# Assign data + visibility.
	for i in range(_card_pool.size()):
		var card = _card_pool[i]
		if i < pibes.size():
			card.set_pibe(pibes[i])
			card.visible = true
		else:
			card.visible = false

func _on_card_tapped(pibe_id: String) -> void:
	FlowRouter.go_pibe_detail(pibe_id)
