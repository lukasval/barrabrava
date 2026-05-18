extends Node

# Public config + feature flags. URLs are public (privacy policy, reset
# password page). Feature flags enforce Phase 1 invariants (no analytics, no
# push, no GPS yet — PRV-05 in Plan 05 hardens this with assert()s and AAIP
# documentation).
#
# NOTE: This is a Plan 04 STUB. Plan 05 (Task 2) extends this file with full
# constants and asserts. We create it now because AuthScreen.gd references
# AppConfig.PRIVACY_URL on _ready and Godot would fail to parse otherwise.
# Plan 05 must NOT delete this file — it must replace the values.

# Placeholder pointing to the GitHub Pages site that Plan 05 stands up. The
# repo + domain are decided in Plan 05; until then we use a parseable URL
# that visibly identifies itself as a stub when opened.
const SITE_BASE := "https://lukasval.github.io/barrabrava"
const PRIVACY_URL := SITE_BASE + "/privacy/"
const PRIVACY_URL_EN := SITE_BASE + "/privacy/en.html"
const TERMS_URL := SITE_BASE + "/terms/"
const PASSWORD_RESET_BASE_URL := SITE_BASE + "/reset-password/"
const RESET_PASSWORD_URL := PASSWORD_RESET_BASE_URL  # alias for legacy refs

# Feature flags. Phase 2 flips PUSH_NOTIFICATIONS_ENABLED on; analytics + GPS
# stay off until later phases (PRV-05 hardening in _ready asserts).
const ANALYTICS_ENABLED := false
const PUSH_NOTIFICATIONS_ENABLED := true
const GPS_ENABLED := false

# Phase 2: FCM topic prefix. Topic name = FCM_TOPIC_PREFIX + club_id.
# Server (sendTopic / validateTopicName) enforces the same prefix shape.
const FCM_TOPIC_PREFIX := "club_"

# Minimum age (Apple + Google policies). UI gates around this constant.
const MIN_AGE := 13

func _ready() -> void:
	# PRV-05 hardening: analytics + GPS must stay off until their respective
	# phases sign off. Push is intentionally ON in Phase 2+.
	assert(not ANALYTICS_ENABLED, "PRV-05: analytics must stay off until Phase 7 (privacy review)")
	assert(not GPS_ENABLED, "PRV-05: GPS must stay off until Phase 3+ (anti-cheat review)")
	print("[AppConfig] site=%s analytics=%s push=%s gps=%s min_age=%d topic_prefix=%s" % [SITE_BASE, ANALYTICS_ENABLED, PUSH_NOTIFICATIONS_ENABLED, GPS_ENABLED, MIN_AGE, FCM_TOPIC_PREFIX])
