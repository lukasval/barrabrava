extends Control

# First-launch + post-launch entry point. Shows parodia disclaimer (CLB-02) once,
# waits up to 3s for AuthManager to restore a session, then routes:
#   - authenticated + has profile  → HomeScreen
#   - authenticated + no profile   → ClubPickerScreen (mid-onboarding)
#   - not authenticated            → AuthScreen

const APP_CFG := "user://app.cfg"
const MIN_SPLASH_MS := 800  # avoid jarring flash

@onready var disclaimer_label: Label = $VBox/Disclaimer
@onready var progress: ProgressBar = $VBox/ProgressBar
@onready var loading_label: Label = $VBox/LoadingLabel

var _restore_attempted := false

func _ready() -> void:
	var cfg = ConfigFile.new()
	var has_seen = false
	if cfg.load(APP_CFG) == OK:
		has_seen = cfg.get_value("first_launch", "disclaimer_seen", false)
	disclaimer_label.visible = not has_seen
	# Listen for AuthManager finishing its restore attempt
	if not AuthManager.session_ready.is_connected(_on_session_ready):
		AuthManager.session_ready.connect(_on_session_ready)
	if not AuthManager.session_cleared.is_connected(_on_session_cleared):
		AuthManager.session_cleared.connect(_on_session_cleared)
	_wait_and_route(has_seen)

func _on_session_ready(_s) -> void:
	_restore_attempted = true

func _on_session_cleared() -> void:
	_restore_attempted = true

func _wait_and_route(disclaimer_was_seen: bool) -> void:
	var start := Time.get_ticks_msec()
	var deadline := start + 3000
	while Time.get_ticks_msec() < deadline:
		if AuthManager.session != null or _restore_attempted:
			break
		await get_tree().create_timer(0.1).timeout
	if not disclaimer_was_seen:
		var cfg = ConfigFile.new()
		cfg.set_value("first_launch", "disclaimer_seen", true)
		cfg.save(APP_CFG)
	var elapsed := Time.get_ticks_msec() - start
	if elapsed < MIN_SPLASH_MS:
		await get_tree().create_timer((MIN_SPLASH_MS - elapsed) / 1000.0).timeout
	if AuthManager.is_authenticated():
		var res = await PlayerStore.load_from_server()
		if res.ok and PlayerStore.has_profile():
			FlowRouter.go_home()
		else:
			FlowRouter.go_club_picker()
	else:
		FlowRouter.go_auth()
