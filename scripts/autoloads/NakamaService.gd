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
