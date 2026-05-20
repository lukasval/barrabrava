extends Control

# RecruitScreen — daily 3-pibe pool selection.
# UI-SPEC §5.3. Asymmetric reveal (D-10). Refresh countdown to 05:00 ART (D-09).
# RankGateLabel per D-12. Lunfardo error mapping per PATTERNS §Lunfardo Error Copy.
# T-3-UIB-09: CTA disabled-during-RPC pattern via RecruitCard pick_selected signal.

@onready var back_button: Button = $TopBar/BackButton
@onready var title_label: Label = $TopBar/Title
@onready var refresh_countdown: Label = $TopBar/RefreshCountdown
@onready var info_label: Label = $HeaderInfo/InfoLabel
@onready var rank_gate_label: Label = $HeaderInfo/RankGateLabel
@onready var scroll: ScrollContainer = $ScrollContainer
@onready var cards_box: VBoxContainer = $ScrollContainer/VBox
@onready var empty_state: VBoxContainer = $EmptyState
@onready var cap_banner: Label = $CapBanner
@onready var loading_state: VBoxContainer = $LoadingState
@onready var error_state: VBoxContainer = $ErrorState
@onready var error_label: Label = $ErrorState/ErrorLabel
@onready var retry_button: Button = $ErrorState/RetryButton

@onready var nav_inicio: Node = $BottomNav/NavInicio
@onready var nav_roster: Node = $BottomNav/NavRoster
@onready var nav_aguantadero: Node = $BottomNav/NavAguantadero
@onready var nav_reclutar: Node = $BottomNav/NavReclutar

const RecruitCardScene = preload("res://scenes/components/RecruitCard.tscn")

# RECRUIT_GATES: client-side copy of server rank gates for UI display (D-12).
const RECRUIT_GATES := {
	"pibe":    {"cost": 500, "max_pibes": 2},
	"soldado": {"cost": 400, "max_pibes": 5},
	"capo":    {"cost": 300, "max_pibes": 10},
	"mesa":    {"cost": 200, "max_pibes": 15},
	"lider":   {"cost": 100, "max_pibes": 20},
}

var _cards: Array = []
var _loading := false
var _countdown_timer: float = 0.0

func _ready() -> void:
	title_label.text = "Reclutar pibes"
	back_button.text = "‹ Atrás"
	back_button.pressed.connect(func(): FlowRouter.go_home())
	retry_button.pressed.connect(_load_pool)
	info_label.text = "3 pibes nuevos por día. Refresca a las 05:00."

	# BottomNav connections.
	if nav_inicio and nav_inicio.has_signal("tapped"):
		nav_inicio.tapped.connect(func(): FlowRouter.go_home())
	if nav_roster and nav_roster.has_signal("tapped"):
		nav_roster.tapped.connect(func(): FlowRouter.go_roster())
	if nav_aguantadero and nav_aguantadero.has_signal("tapped"):
		nav_aguantadero.tapped.connect(func(): FlowRouter.go_aguantadero())
	if nav_reclutar and nav_reclutar.has_signal("tapped"):
		nav_reclutar.tapped.connect(func(): pass)  # already here

	_refresh_rank_gate_label()
	_update_refresh_countdown()
	set_process(true)

	_show_loading()
	await _load_pool()

func _process(delta: float) -> void:
	# Update countdown label every second.
	_countdown_timer -= delta
	if _countdown_timer <= 0.0:
		_countdown_timer = 60.0
		_update_refresh_countdown()

func _update_refresh_countdown() -> void:
	# Compute time until next 05:00 ART (UTC-3).
	# UTC-3 = UTC offset -10800 seconds.
	var now_utc := int(Time.get_unix_time_from_system())
	var art_offset := -3 * 3600
	var now_art := now_utc + art_offset
	var seconds_in_day := now_art % 86400
	var target_seconds := 5 * 3600  # 05:00 ART
	var secs_until: int
	if seconds_in_day < target_seconds:
		secs_until = target_seconds - seconds_in_day
	else:
		secs_until = 86400 - seconds_in_day + target_seconds
	var hrs := secs_until / 3600
	var mins := (secs_until % 3600) / 60
	refresh_countdown.text = "Próxima ronda en %02d:%02d" % [hrs, mins]

func _refresh_rank_gate_label() -> void:
	var rank = PlayerStore.rank.to_lower()
	var gate = RECRUIT_GATES.get(rank, RECRUIT_GATES["pibe"])
	var cost = gate.get("cost", 500)
	var max_p = gate.get("max_pibes", 2)
	rank_gate_label.text = "Tu rango: %s — costo %d Plata, máx %d pibés" % [
		rank.capitalize(), cost, max_p
	]

func _show_loading() -> void:
	scroll.visible = false
	empty_state.visible = false
	cap_banner.visible = false
	error_state.visible = false
	loading_state.visible = true

func _show_error(msg: String) -> void:
	scroll.visible = false
	empty_state.visible = false
	loading_state.visible = false
	error_state.visible = true
	error_label.text = msg

func _load_pool() -> void:
	if _loading:
		return
	_loading = true
	_show_loading()
	var resp = await NakamaService.get_recruit_pool()
	_loading = false
	if not resp.get("ok", false):
		_show_error("No pudimos cargar la ronda de hoy. Probá de nuevo.")
		return
	var data = resp.get("data", {})
	PlayerStore.recruit_pool = data
	PlayerStore.recruit_pool_updated.emit()
	_render_pool(data)

func _render_pool(data: Dictionary) -> void:
	loading_state.visible = false
	error_state.visible = false
	var picks: Array = data.get("picks", [])

	# Cap reached check.
	var at_cap = PlayerStore.pibes.size() >= PlayerStore.roster_cap
	if at_cap:
		cap_banner.visible = true
		cap_banner.text = "Tu aguantadero está lleno (%d/%d). Subí de nivel para sumar más pibes." % [
			PlayerStore.pibes.size(), PlayerStore.roster_cap
		]
	else:
		cap_banner.visible = false

	if picks.is_empty():
		scroll.visible = false
		empty_state.visible = true
		return

	scroll.visible = true
	empty_state.visible = false

	# Build exactly 3 cards (or pool picks count).
	while _cards.size() < picks.size():
		var card = RecruitCardScene.instantiate()
		cards_box.add_child(card)
		card.pick_selected.connect(_on_pick_selected)
		_cards.append(card)

	for i in range(_cards.size()):
		var card = _cards[i]
		if i < picks.size():
			card.set_pick(picks[i])
			card.visible = true
		else:
			card.visible = false

func _on_pick_selected(pick_id: String) -> void:
	if pick_id == "":
		return
	# Find pick data by id.
	var picks: Array = PlayerStore.recruit_pool.get("picks", [])
	var pick: Dictionary = {}
	for p in picks:
		if str(p.get("id", "")) == pick_id:
			pick = p
			break

	var nombre = str(pick.get("display_name", "este pibe"))
	var cost = int(pick.get("plata_cost", 500))

	# Check plata sufficiency.
	if PlayerStore.plata < cost:
		var diff = cost - PlayerStore.plata
		var err_dlg = AcceptDialog.new()
		err_dlg.dialog_text = "Te faltan %d de Plata para reclutar a este pibé." % diff
		err_dlg.dialog_hide_on_ok = true
		add_child(err_dlg)
		err_dlg.popup_centered()
		# Re-enable card button.
		_reenable_card(pick_id)
		return

	# Confirmation dialog.
	var dlg = ConfirmationDialog.new()
	dlg.dialog_text = "¿Reclutar a %s? Te cuesta %d Plata." % [nombre, cost]
	dlg.ok_button_text = "Reclutar"
	dlg.cancel_button_text = "Cancelar"
	add_child(dlg)
	dlg.confirmed.connect(func(): _perform_recruit(pick_id))
	dlg.canceled.connect(func(): _reenable_card(pick_id))
	dlg.popup_centered()

func _reenable_card(pick_id: String) -> void:
	for card in _cards:
		if card.visible and card._pick_data.get("id", "") == pick_id:
			if card._recruit_btn:
				card._recruit_btn.disabled = false

func _perform_recruit(pick_id: String) -> void:
	var resp = await NakamaService.recruit_pibe(pick_id)
	if not resp.get("ok", false):
		var err = str(resp.get("error", ""))
		var msg: String
		if "pick_already_taken" in err:
			msg = "Ya se lo llevó otro, andá rapidito."
		elif "plata_insufficient" in err or "not enough" in err.to_lower():
			msg = "Te faltan Plata para reclutar a este pibé."
		elif "lifetime_cap_reached" in err or "roster_cap" in err:
			msg = "Llegaste al tope de pibes para tu rango. Subí de Soldado primero."
		else:
			msg = "No pudimos reclutar al pibé. Probá de nuevo."
		var err_dlg = AcceptDialog.new()
		err_dlg.dialog_text = msg
		add_child(err_dlg)
		err_dlg.popup_centered()
		_reenable_card(pick_id)
		return

	# Success: update PlayerStore + route to Roster.
	var data = resp.get("data", {})
	# Deduct plata from cache.
	var picks: Array = PlayerStore.recruit_pool.get("picks", [])
	for p in picks:
		if str(p.get("id", "")) == pick_id:
			PlayerStore.plata = max(0, PlayerStore.plata - int(p.get("plata_cost", 0)))
	PlayerStore.resources_updated.emit()
	await PlayerStore.refresh_resources_and_roster()
	# Route to RosterScreen — trait reveal animation A-05 plays on screen entry.
	FlowRouter.go_roster()
