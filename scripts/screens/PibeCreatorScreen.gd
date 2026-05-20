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
		var msg_lower = msg.to_lower()
		if "ese nombre" in msg_lower or "name" in msg_lower or "máximo" in msg_lower:
			error_label.text = "Ese nombre no va. Elegí otro."
		elif "already exists" in msg_lower:
			error_label.text = "Ya tenés un pibe creado, chabón."
		else:
			error_label.text = "Algo salió mal. Probá de nuevo."
		error_label.visible = true
		return
	var pibe = JSON.parse_string(resp.payload)
	PlayerStore.pibe_id = str(pibe.get("id", ""))
	PlayerStore.pibe_name = str(pibe.get("name", ""))
	PlayerStore.club_id = str(pibe.get("club_id", PlayerStore.club_id))
	await PlayerStore.load_from_server()
	# Rule 2 fix: route via go_post_pibe_create() so returning users (tutorial_done=true)
	# skip directly to HomeScreen. go_tutorial() bypasses the tutorial_done gate.
	FlowRouter.go_post_pibe_create()
