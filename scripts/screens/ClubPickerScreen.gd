extends Control

# Lists all clubs via get_clubs RPC (paginated using `total` returned by server,
# up to 10 pages of page_size=100), filters by division (ChipButton scroll) and
# by free-text search (debounced 200ms). On selection, stores club_id in
# PlayerStore and routes to PibeCreatorScreen.
#
# CR-02 fix: server returns {clubs, total, page, page_size}; loop on accumulated
# count vs total instead of a non-existent `has_more` field.

const DIVISIONS := ["Todos", "Primera", "Nacional", "B Metro", "Federal A", "C Metro"]

@onready var search: LineEdit = $VBox/Search
@onready var chips_box: HBoxContainer = $VBox/ChipsScroll/Chips
@onready var scroll: ScrollContainer = $VBox/ClubScroll
@onready var list_box: VBoxContainer = $VBox/ClubScroll/List
@onready var cta: Button = $VBox/CTA
@onready var empty_state: VBoxContainer = $VBox/EmptyState

const ClubCardScene = preload("res://scenes/components/ClubCard.tscn")
const ChipButtonScene = preload("res://scenes/components/ChipButton.tscn")

var _current_division := "Todos"
var _selected_club_id := ""
var _selected_card: Node = null
var _all_clubs: Array = []
var _search_debounce: float = 0.0
# WR-07 fix: pool de ClubCards reutilizables — evita queue_free+instantiate
# en cada filter/search change (con 133 clubs eran ~800 nodos por keystroke).
var _card_pool: Array = []

func _ready() -> void:
	cta.disabled = true
	cta.text = "Me banco este club"
	cta.pressed.connect(_on_cta)
	search.text_changed.connect(_on_search_changed)
	empty_state.visible = false
	_build_chips()
	_load_clubs()

func _build_chips() -> void:
	for div in DIVISIONS:
		var chip = ChipButtonScene.instantiate()
		chip.label_text = div
		chip.is_selected = (div == _current_division)
		chip.pressed.connect(_on_chip_pressed.bind(div, chip))
		chips_box.add_child(chip)

func _on_chip_pressed(div: String, chip: Node) -> void:
	_current_division = div
	for c in chips_box.get_children():
		c.is_selected = (c == chip)
	_render_clubs()

func _on_search_changed(_t: String) -> void:
	_search_debounce = 0.2
	set_process(true)

func _process(delta: float) -> void:
	if _search_debounce > 0.0:
		_search_debounce -= delta
		if _search_debounce <= 0.0:
			_render_clubs()
			set_process(false)

func _load_clubs() -> void:
	var session = AuthManager.session
	var page_size := 100
	var payload = JSON.stringify({"division": "Todos", "page": 1, "page_size": page_size})
	var resp = await NakamaService.client.rpc_async(session, "get_clubs", payload)
	if resp.is_exception():
		push_error("[ClubPicker] get_clubs failed: %s" % resp.get_exception().message)
		return
	var data = JSON.parse_string(resp.payload)
	_all_clubs = data.get("clubs", [])
	var total: int = int(data.get("total", _all_clubs.size()))
	var page := 2
	while _all_clubs.size() < total and page < 10:
		var p = JSON.stringify({"division": "Todos", "page": page, "page_size": page_size})
		var r = await NakamaService.client.rpc_async(session, "get_clubs", p)
		if r.is_exception():
			break
		data = JSON.parse_string(r.payload)
		_all_clubs.append_array(data.get("clubs", []))
		page += 1
	_render_clubs()

func _render_clubs() -> void:
	# WR-07 fix: usa pool de cards reutilizables en vez de free+instantiate.
	# Crece el pool si hace falta, asigna data + visibilidad, oculta los sobrantes.
	_selected_card = null
	_selected_club_id = ""
	cta.disabled = true
	var q := search.text.strip_edges().to_lower()
	var filtered: Array = []
	for club in _all_clubs:
		if _current_division != "Todos" and club.get("division", "") != _current_division:
			continue
		if q.length() > 0:
			var name_str = str(club.get("lunfardo_name", "")).to_lower()
			var barrio = str(club.get("barrio_hq", "")).to_lower()
			if not (q in name_str or q in barrio):
				continue
		filtered.append(club)
	empty_state.visible = filtered.size() == 0
	scroll.visible = filtered.size() > 0
	# Grow pool to match needed size.
	while _card_pool.size() < filtered.size():
		var new_card = ClubCardScene.instantiate()
		list_box.add_child(new_card)
		new_card.tapped.connect(_on_card_pool_tapped.bind(new_card))
		_card_pool.append(new_card)
	# Assign data + visibility to all pool entries.
	for i in range(_card_pool.size()):
		var card = _card_pool[i]
		if i < filtered.size():
			card.set_club(filtered[i])
			card.set_meta("club_data", filtered[i])
			card.visible = true
			card.set_selected(false)
		else:
			card.visible = false

func _on_card_pool_tapped(card: Node) -> void:
	var club = card.get_meta("club_data", {})
	if _selected_card != null and is_instance_valid(_selected_card):
		_selected_card.set_selected(false)
	_selected_card = card
	card.set_selected(true)
	_selected_club_id = str(club.get("id", ""))
	cta.disabled = false

func _on_cta() -> void:
	if _selected_club_id == "":
		return
	PlayerStore.club_id = _selected_club_id
	FlowRouter.go_pibe_creator()
