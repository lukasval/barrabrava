extends Control

# Phase 1 placeholder hub per UI-SPEC §HomeScreen. Empty-state copy + delete
# account flow (PRV-03) + bottom nav (only "Inicio" wired in Phase 1).

@onready var pibe_label: Label = $TopBar/PibeName
@onready var club_label: Label = $TopBar/ClubName
@onready var empty_heading: Label = $Content/Empty/Heading
@onready var empty_body: Label = $Content/Empty/Body
@onready var window_banner: Label = $Content/WindowBanner
@onready var delete_button: Button = $Content/DeleteAccount

const _LOWER_DIVISIONS := ["b_metro", "federal_a", "c_metro"]

func _ready() -> void:
	if PlayerStore.pibe_name == "":
		await PlayerStore.load_from_server()
	pibe_label.text = PlayerStore.pibe_name if PlayerStore.pibe_name != "" else "Pibe"
	club_label.text = PlayerStore.club_name if PlayerStore.club_name != "" else "—"
	empty_heading.text = "Tu barra te espera."
	empty_body.text = "Empezá a laburar."
	delete_button.text = "Borrar mi cuenta"
	delete_button.pressed.connect(_on_delete)
	# Phase 2: fetch + render heartbeat window banner.
	window_banner.text = "Cargando..."
	_refresh_window()

# Phase 2 — Godot 4 OS-level virtual; the underscore prefix is required
# (https://docs.godotengine.org/en/4.3/classes/class_object.html#class-object-private-method-notification).
func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_RESUMED:
		if PlayerStore.club_id != "":
			NakamaService.subscribe_to_club_topic(PlayerStore.club_id)
		_refresh_window()

func _refresh_window() -> void:
	var resp := await NakamaService.get_current_window()
	if resp.get("ok", false):
		var data = resp.get("data", {})
		if typeof(data) == TYPE_DICTIONARY:
			var win = data.get("window", null)
			PlayerStore.current_window = win if typeof(win) == TYPE_DICTIONARY else {}
	_update_window_banner()

func _update_window_banner() -> void:
	var w: Dictionary = PlayerStore.current_window
	var is_lower_division := PlayerStore.club_division in _LOWER_DIVISIONS

	if w.is_empty():
		if is_lower_division:
			window_banner.text = "Coming soon — sin partidos vivos esta season"
			window_banner.modulate = Color(0.6, 0.6, 0.8, 1.0)
		else:
			window_banner.text = "Sin partidos próximos."
			window_banner.modulate = Color(0.5, 0.5, 0.5, 1.0)
		return

	var state := str(w.get("state", ""))
	match state:
		"scheduled":
			var secs := int(w.get("seconds_until_open", 0))
			var hrs := secs / 3600
			var mins := (secs % 3600) / 60
			window_banner.text = "Falta para que abra la ventana: %02d:%02d" % [hrs, mins]
			window_banner.modulate = Color(1.0, 0.8, 0.0, 1.0)
		"open", "live":
			window_banner.text = "¡Ventana abierta! Tu club juega ahora."
			window_banner.modulate = Color(0.2, 0.8, 0.2, 1.0)
		"closed", "cancelled":
			window_banner.text = "Ventana cerrada. Próximo partido próximamente."
			window_banner.modulate = Color(0.5, 0.5, 0.5, 1.0)
		_:
			window_banner.text = "Sin partidos próximos."
			window_banner.modulate = Color(0.5, 0.5, 0.5, 1.0)

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
	# WR-05 fix: deshabilita el botón mientras el RPC está in-flight (evita
	# double-tap → 2 RPCs concurrentes) y muestra un AcceptDialog visible si
	# el RPC falla (en vez de solo push_error a consola, que deja al usuario
	# en limbo sin feedback).
	delete_button.disabled = true
	var session = AuthManager.session
	var resp = await NakamaService.client.rpc_async(session, "delete_account", "")
	if resp.is_exception():
		delete_button.disabled = false
		push_error("[HomeScreen] delete_account failed: %s" % resp.get_exception().message)
		var err_dlg = AcceptDialog.new()
		err_dlg.dialog_text = "No pudimos borrar la cuenta. Probá de nuevo en un rato."
		add_child(err_dlg)
		err_dlg.popup_centered()
		return
	# T-1-UI-10: always wipe cache after logout.
	AuthManager.logout()
	PlayerStore.clear()
	# Also clear the first-launch disclaimer flag so the next session sees a
	# clean state (CLB-02 disclaimer will NOT re-show, but session is fresh).
	FlowRouter.go_splash()
