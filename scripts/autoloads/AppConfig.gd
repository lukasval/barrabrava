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
const RESET_PASSWORD_URL := SITE_BASE + "/reset/"

# Feature flags — Phase 1 invariants. Plan 05 adds asserts in _ready().
const ANALYTICS_ENABLED := false
const PUSH_NOTIFICATIONS_ENABLED := false
const GPS_ENABLED := false

func _ready() -> void:
	print("[AppConfig] site=%s analytics=%s push=%s gps=%s" % [SITE_BASE, ANALYTICS_ENABLED, PUSH_NOTIFICATIONS_ENABLED, GPS_ENABLED])
