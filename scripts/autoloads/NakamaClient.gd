extends Node

# Singleton wrapper around the Nakama SDK client.
# Reads host/port/scheme from project settings (set via export var override).
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

var client  # NakamaClient instance (from SDK)

func _ready() -> void:
	# Lazy-load the SDK to avoid load order issues
	var NakamaSDK = preload("res://addons/com.heroiclabs.nakama/Nakama.gd")
	client = NakamaSDK.create_client(
		nakama_server_key,
		nakama_host,
		nakama_port,
		nakama_scheme,
		10  # timeout seconds
	)
	print("[NakamaClient] initialized: %s://%s:%d" % [nakama_scheme, nakama_host, nakama_port])
