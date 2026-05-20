extends Control

# Pibe naming + fixed base stats display per UI-SPEC §PibeCreatorScreen.
# T-1-UI-01 mitigation: the payload sent to create_pibe RPC contains ONLY
# {name, club_id}. Stats are SERVER-ASSIGNED (Plan 03 create_pibe sets all to 50)
# and read back from the RPC response. The client NEVER sends stats.

@onready var name_input: LineEdit = $VBox/NameInput
@onready var preview: Label = $VBox/Preview
@onready var error_label: Label = $VBox/ErrorLabel
@onready var hint_label: Label = $VBox/HintLabel
@onready var cta: Button = $VBox/CTA
@onready var stat_aguante: Label = $VBox/Stats/AguanteValue
@onready var stat_velocidad: Label = $VBox/Stats/VelocidadValue
@onready var stat_astucia: Label = $VBox/Stats/AstuciaValue
@onready var stat_carisma: Label = $VBox/Stats/CarismaValue

func _ready() -> void:
	name_input.max_length = 20
	error_label.visible = false
	hint_label.visible = false
	cta.text = "Así se llama mi pibe"
	cta.disabled = true
	stat_aguante.text = "50"
	stat_velocidad.text = "50"
	stat_astucia.text = "50"
	stat_carisma.text = "50"
	name_input.text_changed.connect(_on_text_changed)
	cta.pressed.connect(_on_submit)

func _on_text_changed(t: String) -> void:
	preview.text = t.strip_edges()
	error_label.visible = false
	hint_label.visible = t.length() >= 19
	cta.disabled = t.strip_edges().length() < 2

func _on_submit() -> void:
	error_label.visible = false
	cta.disabled = true
	# Phase 3 fix: ensure session is fresh (refresh if expired) so we don't
	# silently fail with 401 mid-onboarding.
	if not await AuthManager.ensure_fresh_session():
		error_label.text = "Tu sesión venció. Volvé a entrar."
		error_label.visible = true
		cta.disabled = false
		return
	var session = AuthManager.session
	# T-1-UI-01: ONLY name + club_id — never stats.
	var payload = JSON.stringify({
		"name": name_input.text.strip_edges(),
		"club_id": PlayerStore.club_id,
	})
	var resp = await NakamaService.client.rpc_async(session, "create_pibe", payload)
	cta.disabled = false
	if resp.is_exception():
		var msg = str(resp.get_exception().message)
		push_warning("[PibeCreator] create_pibe exception: %s" % msg)
		var msg_lower = msg.to_lower()
		if "ese nombre" in msg_lower or "name" in msg_lower or "máximo" in msg_lower:
			error_label.text = "Ese nombre no va. Elegí otro."
		elif "already exists" in msg_lower:
			error_label.text = "Ya tenés un pibe creado, chabón."
		else:
			error_label.text = "Algo salió mal. Probá de nuevo. (debug: %s)" % msg
		error_label.visible = true
		return
	var pibe = JSON.parse_string(resp.payload)
	# Server may return either {ok:true, pibe:{...}} or the pibe record directly
	# depending on which validation branch hit. Treat the unwrapped form first.
	if typeof(pibe) == TYPE_DICTIONARY and pibe.has("ok") and pibe.get("ok") == false:
		var err = str(pibe.get("error", "unknown_error"))
		push_warning("[PibeCreator] create_pibe returned ok=false: %s" % err)
		match err:
			"invalid_name", "name_too_short", "name_too_long", "name_charset":
				error_label.text = "Ese nombre no va. Elegí otro."
			"name_in_deny_list":
				error_label.text = "Ese nombre no se puede usar. Elegí otro."
			"club_not_found", "invalid_club_id":
				error_label.text = "El club no existe. Volvé a elegir."
			"pibe_already_exists":
				error_label.text = "Ya tenés un pibe creado, chabón."
			_:
				error_label.text = "Algo salió mal. (server: %s)" % err
		error_label.visible = true
		return
	# Unwrap server wrapper {ok:true, pibe:{...}} if present.
	if typeof(pibe) == TYPE_DICTIONARY and pibe.has("pibe"):
		pibe = pibe.get("pibe")
	PlayerStore.pibe_id = str(pibe.get("id", ""))
	PlayerStore.pibe_name = str(pibe.get("name", ""))
	PlayerStore.club_id = str(pibe.get("club_id", PlayerStore.club_id))
	await PlayerStore.load_from_server()
	# Rule 2 fix: route via go_post_pibe_create() so returning users (tutorial_done=true)
	# skip directly to HomeScreen. go_tutorial() bypasses the tutorial_done gate.
	FlowRouter.go_post_pibe_create()
