extends Node

# Singleton wrapper around the Nakama SDK client.
# Renamed from "NakamaClient" to avoid class_name collision with the SDK's
# class_name NakamaClient (addons/com.heroiclabs.nakama/client/NakamaClient.gd).
#
# Uses the SDK's own `Nakama` autoload (registered via project.godot) to call
# create_client() — matches the official pattern documented in the SDK README.
#
# NOTE: server_key is the public client identifier shared with the Nakama server
# (NAKAMA_SERVER_KEY env var on Railway). It is NOT a secret — it is a public
# identifier per Nakama's auth model. Will be rotated pre-launch (Phase 7).

const NAKAMA_HOST_DEFAULT := "nakama-production-7ea8.up.railway.app"
const NAKAMA_PORT_DEFAULT := 443
const NAKAMA_SCHEME_DEFAULT := "https"
const NAKAMA_SERVER_KEY_DEFAULT := "aee9c099d52a6c22f52fb8bc9f4b72d9"

@export var nakama_host: String = NAKAMA_HOST_DEFAULT
@export var nakama_port: int = NAKAMA_PORT_DEFAULT
@export var nakama_scheme: String = NAKAMA_SCHEME_DEFAULT
@export var nakama_server_key: String = NAKAMA_SERVER_KEY_DEFAULT

# The created NakamaClient instance (typed as the SDK's class_name NakamaClient).
var client: NakamaClient

func _ready() -> void:
	# Use the SDK's `Nakama` singleton autoload to call create_client.
	# This matches the official pattern from the SDK README.
	client = Nakama.create_client(
		nakama_server_key,
		nakama_host,
		nakama_port,
		nakama_scheme,
		10  # timeout seconds
	)
	print("[NakamaService] initialized: %s://%s:%d" % [nakama_scheme, nakama_host, nakama_port])

	# Phase 2: wire FCM token signal if the Android plugin is loaded.
	_wire_fcm_plugin()

# Phase 2 — FCMPlugin wiring. The plugin is installed in plan 02-07 and is only
# available on Android builds; on macOS/iOS/Web/editor builds the singleton is
# absent and we skip silently (with a warning so it shows in dev logs).
func _wire_fcm_plugin() -> void:
	if not AppConfig.PUSH_NOTIFICATIONS_ENABLED:
		return
	var fcm = Engine.get_singleton("FCMPlugin") if Engine.has_singleton("FCMPlugin") else null
	if fcm == null:
		push_warning("[NakamaService] FCMPlugin not available (non-Android build or plugin missing)")
		return
	if not fcm.on_token_received.is_connected(_on_fcm_token_received):
		fcm.on_token_received.connect(_on_fcm_token_received)
	# Some FCM implementations only emit on refresh — force initial emission.
	fcm.getToken()

func _on_fcm_token_received(token: String) -> void:
	if token.is_empty():
		push_warning("[NakamaService] FCM token received but empty; skipping registration")
		return
	# Fire-and-forget — signal handler must not await.
	register_fcm_token.call_deferred(token, "android")

# Phase 2 — Persist this device's FCM registration token on the server.
# Server stores it singleton-per-user in COL_FCM_TOKENS (plan 02-06).
func register_fcm_token(token: String, platform: String) -> Dictionary:
	if not AuthManager.is_authenticated():
		return {"ok": false, "error": "not_authenticated"}
	var session = AuthManager.session
	var payload = JSON.stringify({"token": token, "platform": platform})
	var resp = await client.rpc_async(session, "register_fcm_token", payload)
	if resp.is_exception():
		push_warning("[NakamaService] register_fcm_token failed: " + str(resp.get_exception().message))
		return {"ok": false, "error": str(resp.get_exception().message)}
	var data = JSON.parse_string(resp.payload)
	if typeof(data) != TYPE_DICTIONARY:
		return {"ok": false, "error": "invalid_response"}
	return {"ok": true, "data": data}

# Phase 2 — Subscribe the device to the FCM topic for its club.
# Idempotent: tracks subscribed_topics in PlayerStore to short-circuit repeat calls.
# D-09: topic = AppConfig.FCM_TOPIC_PREFIX + club_id.
func subscribe_to_club_topic(club_id: String) -> Dictionary:
	if not AppConfig.PUSH_NOTIFICATIONS_ENABLED:
		return {"ok": false, "error": "push_disabled"}
	if club_id.is_empty():
		return {"ok": false, "error": "club_id_required"}
	var topic = AppConfig.FCM_TOPIC_PREFIX + club_id
	if PlayerStore.subscribed_topics.has(topic):
		return {"ok": true, "already_subscribed": true, "topic": topic}
	var fcm = Engine.get_singleton("FCMPlugin") if Engine.has_singleton("FCMPlugin") else null
	if fcm == null:
		push_warning("[NakamaService] FCMPlugin not available; cannot subscribe to topic " + topic)
		return {"ok": false, "error": "fcm_unavailable"}
	fcm.subscribeToTopic(topic)
	PlayerStore.subscribed_topics.append(topic)
	return {"ok": true, "topic": topic}

# Phase 2 — Server returns the next/current active match window for the
# authenticated player's club. HomeScreen calls this on _ready + on app resume.
func get_current_window() -> Dictionary:
	if not AuthManager.is_authenticated():
		return {"ok": false, "error": "not_authenticated"}
	var session = AuthManager.session
	var resp = await client.rpc_async(session, "get_current_window", "{}")
	if resp.is_exception():
		return {"ok": false, "error": str(resp.get_exception().message)}
	var data = JSON.parse_string(resp.payload)
	if typeof(data) != TYPE_DICTIONARY:
		return {"ok": false, "error": "invalid_response"}
	return {"ok": true, "data": data}
