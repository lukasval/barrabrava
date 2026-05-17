extends Control

# Phase 1 placeholder hub per UI-SPEC §HomeScreen. Empty-state copy + delete
# account flow (PRV-03) + bottom nav (only "Inicio" wired in Phase 1).

@onready var pibe_label: Label = $TopBar/PibeName
@onready var club_label: Label = $TopBar/ClubName
@onready var empty_heading: Label = $Content/Empty/Heading
@onready var empty_body: Label = $Content/Empty/Body
@onready var delete_button: Button = $Content/DeleteAccount

func _ready() -> void:
	if PlayerStore.pibe_name == "":
		await PlayerStore.load_from_server()
	pibe_label.text = PlayerStore.pibe_name if PlayerStore.pibe_name != "" else "Pibe"
	club_label.text = PlayerStore.club_name if PlayerStore.club_name != "" else "—"
	empty_heading.text = "Tu barra te espera."
	empty_body.text = "Empezá a laburar."
	delete_button.text = "Borrar mi cuenta"
	delete_button.pressed.connect(_on_delete)

func _on_delete() -> void:
	# T-1-UI-05: double-confirmation before destructive action.
	var dlg = ConfirmationDialog.new()
	dlg.dialog_text = "¿Seguro? Esto borra todo tu progreso y no se puede deshacer."
	dlg.ok_button_text = "Sí, borrá todo"
	dlg.cancel_button_text = "Cancelar"
	add_child(dlg)
	dlg.confirmed.connect(_perform_delete)
	dlg.popup_centered()

func _perform_delete() -> void:
	var session = AuthManager.session
	var resp = await NakamaService.client.rpc_async(session, "delete_account", "")
	if resp.is_exception():
		push_error("[HomeScreen] delete_account failed: %s" % resp.get_exception().message)
		return
	# T-1-UI-10: always wipe cache after logout.
	AuthManager.logout()
	PlayerStore.clear()
	# Also clear the first-launch disclaimer flag so the next session sees a
	# clean state (CLB-02 disclaimer will NOT re-show, but session is fresh).
	FlowRouter.go_splash()
