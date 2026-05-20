extends Control

# Phase 1 placeholder hub per UI-SPEC §HomeScreen. Empty-state copy + delete
# account flow (PRV-03) + bottom nav (only "Inicio" wired in Phase 1).
#
# Phase 3 EXTENSION (UI-SPEC §5.1):
# - ResourceRow with 4 ResourceWidget instances (Plata/Aguante/Rep/VBC)
# - TurnoButton (visible when window.state in [open, live], D-03)
# - QuickActions row (Laburar / Reclutar / Aguantadero)
# - IdleNotice label (conditional idle-accrual copy)
# - FaccionLabel + RankBadge in TopBar (D-16)
# - BottomNav slots renamed: Inicio / Roster / Aguantadero / Reclutar [OVERRIDE]
# - DeleteAccount moved to TopBar overflow ⋮ menu (still accessible for PRV-03)

@onready var pibe_label: Label = $TopBar/PibeName
@onready var club_label: Label = $TopBar/ClubName
@onready var faccion_label: Label = $TopBar/FaccionLabel
@onready var rank_badge: PanelContainer = $TopBar/RankBadge
@onready var overflow_button: Button = $TopBar/OverflowBtn

@onready var plata_widget: VBoxContainer = $ResourceRow/PlataWidget
@onready var aguante_widget: VBoxContainer = $ResourceRow/AguanteWidget
@onready var rep_widget: VBoxContainer = $ResourceRow/ReputacionWidget
@onready var vbc_widget: VBoxContainer = $ResourceRow/VBCWidget

@onready var window_banner: Label = $Content/WindowBanner
@onready var turno_button: Button = $Content/TurnoButton
@onready var laburar_button: Button = $Content/QuickActions/Laburar
@onready var reclutar_button: Button = $Content/QuickActions/Reclutar
@onready var aguantadero_button: Button = $Content/QuickActions/Aguantadero
@onready var idle_notice: Label = $Content/IdleNotice
@onready var empty_heading: Label = $Content/Empty/Heading
@onready var empty_body: Label = $Content/Empty/Body

@onready var nav_inicio: Node = $BottomNav/NavInicio
@onready var nav_roster: Node = $BottomNav/NavRoster
@onready var nav_aguantadero: Node = $BottomNav/NavAguantadero
@onready var nav_reclutar: Node = $BottomNav/NavReclutar

const _LOWER_DIVISIONS := ["b_metro", "federal_a", "c_metro"]

# Cached previous rank for promotion flash (D-13, A-07).
var _prev_rank: String = ""

func _ready() -> void:
	if PlayerStore.pibe_name == "":
		await PlayerStore.load_from_server()
	pibe_label.text = PlayerStore.pibe_name if PlayerStore.pibe_name != "" else "Pibe"
	club_label.text = PlayerStore.club_name if PlayerStore.club_name != "" else "—"
	faccion_label.text = PlayerStore.faccion if PlayerStore.faccion != "" else ""

	# Empty state copy (Phase 1 carry).
	empty_heading.text = "Tu barra te espera."
	empty_body.text = "Reclutá tu primer pibe para arrancar."

	# Phase 3: connect signals + buttons.
	PlayerStore.resources_updated.connect(_refresh_resource_widgets)
	PlayerStore.roster_updated.connect(_refresh_turno_button)
	PlayerStore.roster_updated.connect(_refresh_idle_notice)
	turno_button.pressed.connect(_open_turno_modal)
	laburar_button.pressed.connect(func(): FlowRouter.go_roster())
	reclutar_button.pressed.connect(func(): FlowRouter.go_recruit())
	aguantadero_button.pressed.connect(func(): FlowRouter.go_aguantadero())
	overflow_button.pressed.connect(_on_overflow)

	# BottomNav connections.
	if nav_inicio and nav_inicio.has_signal("tapped"):
		nav_inicio.tapped.connect(func(): pass)  # already home
	if nav_roster and nav_roster.has_signal("tapped"):
		nav_roster.tapped.connect(func(): FlowRouter.go_roster())
	if nav_aguantadero and nav_aguantadero.has_signal("tapped"):
		nav_aguantadero.tapped.connect(func(): FlowRouter.go_aguantadero())
	if nav_reclutar and nav_reclutar.has_signal("tapped"):
		nav_reclutar.tapped.connect(func(): FlowRouter.go_recruit())

	# Loading state: ResourceWidgets show em-dash.
	_set_resource_widgets_loading()

	# Phase 2: fetch window banner.
	window_banner.text = "Cargando..."

	# Phase 3: fetch roster + resources.
	await PlayerStore.refresh_resources_and_roster()
	_refresh_resource_widgets()
	_refresh_turno_button()
	_refresh_idle_notice()
	_refresh_rank_badge()

	# Phase 2: fetch window state.
	_refresh_window()

# Phase 2/3 — OS virtual for app-resume.
func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_RESUMED:
		if PlayerStore.club_id != "":
			NakamaService.subscribe_to_club_topic(PlayerStore.club_id)
		await PlayerStore.refresh_resources_and_roster()
		_refresh_resource_widgets()
		_refresh_turno_button()
		_refresh_idle_notice()
		_refresh_rank_badge()
		_refresh_window()

func _refresh_window() -> void:
	var resp := await NakamaService.get_current_window()
	if resp.get("ok", false):
		var data = resp.get("data", {})
		if typeof(data) == TYPE_DICTIONARY:
			var win = data.get("window", null)
			PlayerStore.current_window = win if typeof(win) == TYPE_DICTIONARY else {}
	_update_window_banner()
	_refresh_turno_button()

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

# Phase 3 — Resource widgets.

func _set_resource_widgets_loading() -> void:
	for widget in [plata_widget, aguante_widget, rep_widget, vbc_widget]:
		if widget and widget.has_method("set_value"):
			widget.modulate.a = 0.4

func _refresh_resource_widgets() -> void:
	for widget in [plata_widget, aguante_widget, rep_widget, vbc_widget]:
		if widget:
			widget.modulate.a = 1.0
	if plata_widget and plata_widget.has_method("set_value"):
		plata_widget.set_value(PlayerStore.plata)
	if aguante_widget and aguante_widget.has_method("set_value"):
		# Group aguante — sourced from barra_state; Phase 3 shows contributed total.
		aguante_widget.set_value(PlayerStore.aguante_contributed_total)
	if rep_widget and rep_widget.has_method("set_value"):
		rep_widget.set_value(PlayerStore.reputacion)
	if vbc_widget and vbc_widget.has_method("set_value"):
		vbc_widget.set_value(PlayerStore.vbc)
	_refresh_idle_cap_warning()

func _refresh_idle_cap_warning() -> void:
	# A-08: pulse Plata ResourceWidget when any pibe is at 12h idle cap.
	# (Check deferred to post-recruit when pibe data is available)
	pass

func _refresh_rank_badge() -> void:
	if rank_badge and rank_badge.has_method("set_rank"):
		var new_rank = PlayerStore.rank
		if _prev_rank != "" and _prev_rank != new_rank:
			# D-13 / A-07: promotion flash.
			rank_badge.play_promotion_flash()
		_prev_rank = new_rank
		rank_badge.set_rank(new_rank)

# Phase 3 — TurnoButton visibility (D-03).
func _refresh_turno_button() -> void:
	var win = PlayerStore.current_window
	var visible_val = typeof(win) == TYPE_DICTIONARY and (
		win.get("state", "") == "open" or win.get("state", "") == "live"
	)
	turno_button.visible = visible_val
	if visible_val:
		var eligible = _count_eligible_pibes()
		turno_button.disabled = eligible == 0
		if eligible > 0:
			turno_button.text = "Hacer turno"
			_start_turno_pulse()
		else:
			turno_button.text = "Sin pibes con energía"
			turno_button.modulate.a = 0.4
	else:
		_stop_turno_pulse()

func _count_eligible_pibes() -> int:
	var c := 0
	for p in PlayerStore.pibes:
		if typeof(p) == TYPE_DICTIONARY and int(p.get("energia", 0)) >= 30:
			var et = p.get("en_turno_until", null)
			if et == null or str(et) == "null":
				c += 1
			elif int(str(et)) < int(Time.get_unix_time_from_system() * 1000):
				c += 1
	return c

# A-03: TurnoButton pulse (1400ms loop).
var _turno_tween: Tween = null

func _start_turno_pulse() -> void:
	if _turno_tween != null and _turno_tween.is_running():
		return
	turno_button.modulate.a = 1.0
	_turno_tween = create_tween()
	_turno_tween.set_loops()
	_turno_tween.tween_property(turno_button, "scale", Vector2(1.03, 1.03), 0.7)
	_turno_tween.tween_property(turno_button, "scale", Vector2(1.0, 1.0), 0.7)

func _stop_turno_pulse() -> void:
	if _turno_tween != null:
		_turno_tween.kill()
		_turno_tween = null
	turno_button.scale = Vector2(1.0, 1.0)

# Phase 3 — IdleNotice (UI-SPEC §8.2).
func _refresh_idle_notice() -> void:
	# Show notice when there is idle Plata to collect.
	# Simplified: show if PlayerStore.pibes has any with profession assigned.
	# Full idle accumulation check requires collect_idle dry-run — deferred.
	# For now show empty to avoid false positives.
	idle_notice.visible = false

# Phase 3 — Open TurnoModal.
func _open_turno_modal() -> void:
	var modal_scene = preload("res://scenes/TurnoModal.tscn")
	var modal = modal_scene.instantiate()
	add_child(modal)
	modal.show_modal(PlayerStore.current_window)
	# Connect turno_submitted to update ResourceWidgets.
	if modal.has_signal("turno_submitted"):
		modal.turno_submitted.connect(_on_turno_submitted)

func _on_turno_submitted(result: Dictionary) -> void:
	if result.get("ok", false):
		var data = result.get("data", {})
		# Update rep from result if present.
		var rep_credited = int(data.get("rep_credited", 0))
		if rep_credited > 0:
			PlayerStore.reputacion += rep_credited
		PlayerStore.resources_updated.emit()
		# Refresh full state.
		await PlayerStore.refresh_resources_and_roster()
		_refresh_resource_widgets()
		_refresh_turno_button()

# Phase 3 — TopBar overflow ⋮ menu (contains DeleteAccount per PRV-03).
func _on_overflow() -> void:
	_on_delete()

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
	# WR-05 fix: deshabilita el botón mientras el RPC está in-flight.
	overflow_button.disabled = true
	# Phase 3 fix: refresh session if expired so a stale token doesn't make
	# delete_account fail silently after the user already confirmed.
	if not await AuthManager.ensure_fresh_session():
		overflow_button.disabled = false
		var err_dlg = AcceptDialog.new()
		err_dlg.dialog_text = "Tu sesión venció. Volvé a entrar para borrar la cuenta."
		add_child(err_dlg)
		err_dlg.popup_centered()
		return
	var session = AuthManager.session
	var resp = await NakamaService.client.rpc_async(session, "delete_account", "")
	if resp.is_exception():
		overflow_button.disabled = false
		push_error("[HomeScreen] delete_account failed: %s" % resp.get_exception().message)
		var err_dlg = AcceptDialog.new()
		err_dlg.dialog_text = "No pudimos borrar la cuenta. Probá de nuevo en un rato."
		add_child(err_dlg)
		err_dlg.popup_centered()
		return
	# T-1-UI-10: always wipe cache after logout.
	AuthManager.logout()
	PlayerStore.clear()
	FlowRouter.go_splash()
