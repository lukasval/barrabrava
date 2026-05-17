extends Control

# Lists all clubs via get_clubs RPC (paginated, follows has_more=true up to 10 pages),
# filters by division (ChipButton scroll) and by free-text search (debounced 200ms).
# On selection, stores club_id in PlayerStore and routes to PibeCreatorScreen.

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
	var payload = JSON.stringify({"division": "Todos", "page": 1})
	var resp = await NakamaService.client.rpc_async(session, "get_clubs", payload)
	if resp.is_exception():
		push_error("[ClubPicker] get_clubs failed: %s" % resp.get_exception().message)
		return
	var data = JSON.parse_string(resp.payload)
	_all_clubs = data.get("clubs", [])
	var page = 2
	while data.get("has_more", false) and page < 10:
		var p = JSON.stringify({"division": "Todos", "page": page})
		var r = await NakamaService.client.rpc_async(session, "get_clubs", p)
		if r.is_exception():
			break
		data = JSON.parse_string(r.payload)
		_all_clubs.append_array(data.get("clubs", []))
		page += 1
	_render_clubs()

func _render_clubs() -> void:
	for c in list_box.get_children():
		c.queue_free()
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
	for club in filtered:
		var card = ClubCardScene.instantiate()
		list_box.add_child(card)
		card.set_club(club)
		card.tapped.connect(_on_club_tapped.bind(card, club))

func _on_club_tapped(card: Node, club: Dictionary) -> void:
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
