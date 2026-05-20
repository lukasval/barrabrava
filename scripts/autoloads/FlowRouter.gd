extends Node

# Centralized scene navigation with 150ms fade in/out (UI-SPEC §Screen Flow).
# Autoload order in project.godot: Nakama, NakamaService, AuthManager, AppTheme,
# AppConfig, PlayerStore, FlowRouter (last — depends on AppTheme + PlayerStore).

const TRANSITION_MS := 150

signal transition_started(target_path)
signal transition_finished(target_path)

var _fade_layer: CanvasLayer
var _fade_rect: ColorRect
var _transitioning := false

func _ready() -> void:
	_setup_fade_layer()

func _setup_fade_layer() -> void:
	_fade_layer = CanvasLayer.new()
	_fade_layer.layer = 100
	_fade_rect = ColorRect.new()
	_fade_rect.color = Color(0, 0, 0, 0)
	_fade_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_fade_rect.anchor_right = 1.0
	_fade_rect.anchor_bottom = 1.0
	_fade_layer.add_child(_fade_rect)
	get_tree().root.call_deferred("add_child", _fade_layer)

func go_to(scene_path: String) -> void:
	if _transitioning:
		return
	_transitioning = true
	transition_started.emit(scene_path)
	_fade_rect.mouse_filter = Control.MOUSE_FILTER_STOP
	var t := create_tween()
	t.tween_property(_fade_rect, "color:a", 1.0, TRANSITION_MS / 1000.0)
	await t.finished
	get_tree().change_scene_to_file(scene_path)
	await get_tree().process_frame
	var t2 := create_tween()
	t2.tween_property(_fade_rect, "color:a", 0.0, TRANSITION_MS / 1000.0)
	await t2.finished
	_fade_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_transitioning = false
	transition_finished.emit(scene_path)

# Convenience helpers — keep all scene paths in one place.
func go_splash() -> void: go_to("res://scenes/SplashScreen.tscn")
func go_auth() -> void: go_to("res://scenes/AuthScreen.tscn")
func go_forgot_password() -> void: go_to("res://scenes/ForgotPasswordScreen.tscn")
func go_club_picker() -> void: go_to("res://scenes/ClubPickerScreen.tscn")
func go_pibe_creator() -> void: go_to("res://scenes/PibeCreatorScreen.tscn")
func go_tutorial() -> void: go_to("res://scenes/TutorialScreen.tscn")
func go_home() -> void: go_to("res://scenes/HomeScreen.tscn")

# Phase 2: club confirmation entrypoint. ClubPickerScreen calls this instead of
# raw go_pibe_creator() so the FCM topic subscribe happens at exactly one place.
# subscribe_to_club_topic is idempotent (PlayerStore.subscribed_topics dedup +
# server-side validateTopicName) so re-calls on app resume are safe.
func confirm_club_pick(club_id: String) -> void:
	if club_id != "":
		NakamaService.subscribe_to_club_topic(club_id)
	go_pibe_creator()

# Phase 3 — New screen navigation helpers.
func go_roster() -> void: go_to("res://scenes/RosterScreen.tscn")
func go_recruit() -> void: go_to("res://scenes/RecruitScreen.tscn")
func go_aguantadero() -> void: go_to("res://scenes/AguantaderoScreen.tscn")

func go_pibe_detail(pibe_id: String) -> void:
	# Pass pibe_id via singleton meta (Godot scene-args limitation workaround).
	# Target screen reads via PlayerStore.get_meta("nav_pibe_id").
	PlayerStore.set_meta("nav_pibe_id", pibe_id)
	go_to("res://scenes/PibeDetailScreen.tscn")

func go_profession_assign(pibe_id: String) -> void:
	PlayerStore.set_meta("nav_pibe_id", pibe_id)
	go_to("res://scenes/ProfessionAssignScreen.tscn")

# Post-pibe-create gate (ONB-05 tutorial entry point).
func go_post_pibe_create() -> void:
	if PlayerStore.tutorial_done:
		go_home()
	else:
		go_tutorial()

# Tutorial step orchestrator — called by TutorialScreen step CTAs.
# elapsed_ms is the tutorial duration captured by TutorialScreen on step 1,
# forwarded to NakamaService.complete_tutorial for the LAB-TUTORIAL-DURATION
# server-side telemetry log line.
func tutorial_advance(step: int, elapsed_ms: int = 0) -> void:
	var resp = await NakamaService.complete_tutorial(step, elapsed_ms)
	if resp.get("ok", false):
		var data = resp.get("data", {})
		PlayerStore.tutorial_step = int(data.get("step", step))
		PlayerStore.tutorial_done = bool(data.get("tutorial_done", false))
		if data.has("reward"):
			var reward = data.get("reward", {})
			PlayerStore.cantico_unlocked = str(reward.get("cantico", ""))
		PlayerStore.tutorial_advanced.emit()
		if PlayerStore.tutorial_done:
			go_home()
