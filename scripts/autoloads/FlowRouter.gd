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
