extends Node

# In-memory cache for the player's pibe + club profile, loaded from Nakama storage
# after a successful login. Cleared on logout / delete_account.
#
# Source of truth lives in Nakama Storage:
#   - collection "players", key "profile"            (per-user, owned by user_id)
#   - collection "pibes",   key "main"               (per-user fixed slot — Phase 1 = 1 pibe per account)
#   - collection "clubs",   key <club_id>            (system-owned, user_id = nil UUID)
#
# CR-01 fix: pibe lookup uses fixed key "main" (matches create_pibe.ts).
# The pibe_id UUID is preserved inside the value for future multi-pibe support.

signal profile_loaded
signal profile_cleared

# Phase 3 signals
signal roster_updated
signal resources_updated
signal aguantadero_updated
signal recruit_pool_updated
signal tutorial_advanced

var pibe_id: String = ""
var pibe_name: String = ""
var club_id: String = ""
var club_name: String = ""
var club_division: String = ""           # Phase 2: needed for "Coming soon" lower-division gate.

# Phase 2: push + heartbeat state.
var subscribed_topics: Array[String] = []   # e.g. ["club_xeneizes", ...] — set after subscribe_to_club_topic.
var current_window: Dictionary = {}          # latest get_current_window response; {} if none.

# Phase 3 resources + rank
var rank: String = "pibe"
var plata: int = 0
var reputacion: int = 0
var vbc: int = 0
var aguante_contributed_total: int = 0

# Phase 3 tutorial
var tutorial_done: bool = false
var tutorial_step: int = 0
var cantico_unlocked: String = ""

# Phase 3 roster + aguantadero
var pibes: Array = []
var aguantadero: Dictionary = {}
var recruit_pool: Dictionary = {}
var roster_cap: int = 5

# Phase 3 faccion (D-16 label only)
var faccion: String = ""

func has_profile() -> bool:
	return pibe_id != ""

func clear() -> void:
	pibe_id = ""
	pibe_name = ""
	club_id = ""
	club_name = ""
	club_division = ""
	subscribed_topics.clear()
	current_window = {}
	# Phase 3 reset
	rank = "pibe"
	plata = 0
	reputacion = 0
	vbc = 0
	aguante_contributed_total = 0
	tutorial_done = false
	tutorial_step = 0
	cantico_unlocked = ""
	pibes.clear()
	aguantadero.clear()
	recruit_pool.clear()
	roster_cap = 5
	faccion = ""
	profile_cleared.emit()

# Phase 3 — Refresh roster + aguantadero from server. Called after collect_idle,
# recruit_pibe, or on app resume. Resources (plata/rep/vbc) are updated by callers
# directly from RPC response data, then callers emit resources_updated.
func refresh_resources_and_roster() -> void:
	var roster_resp = await NakamaService.get_roster()
	if roster_resp.get("ok", false):
		var d = roster_resp.get("data", {})
		pibes = d.get("pibes", [])
		roster_cap = int(d.get("roster_cap", 5))
		rank = str(d.get("rank", "pibe"))
		roster_updated.emit()
	var agu_resp = await NakamaService.get_aguantadero()
	if agu_resp.get("ok", false):
		aguantadero = agu_resp.get("data", {}).get("aguantadero", {})
		aguantadero_updated.emit()
	# Resources live on profile; load_from_server already reads profile,
	# but for delta refresh after collect_idle/submit_turno we re-call.
	# Pattern: caller updates plata/reputacion/vbc directly from RPC response
	# (collect_idle returns plata_credited; submit_turno returns rep_credited),
	# then emits resources_updated.
	resources_updated.emit()

func load_from_server() -> Dictionary:
	if not AuthManager.is_authenticated():
		return {"ok": false, "error": "Not authenticated"}
	var session = AuthManager.session
	var read_req = [
		{"collection": StorageKeys.COL_PLAYERS, "key": StorageKeys.KEY_PLAYER_PROFILE, "user_id": session.user_id},
	]
	var resp = await NakamaService.client.read_storage_objects_async(session, read_req)
	if resp.is_exception():
		return {"ok": false, "error": str(resp.get_exception().message)}
	if resp.objects.size() == 0:
		return {"ok": false, "error": "no_profile"}
	# WR-09 fix: defensa contra value corrupto / null — JSON.parse_string puede
	# devolver null (value vacío) o un tipo no-Dictionary (test fixture roto, etc.).
	# Llamar .get() sobre null crashea con "Invalid call to method 'get' on a
	# base of type 'Nil'". Validar typeof y normalizar a string con str().
	var profile_raw = JSON.parse_string(resp.objects[0].value)
	if typeof(profile_raw) != TYPE_DICTIONARY:
		return {"ok": false, "error": "profile_corrupt"}
	var profile: Dictionary = profile_raw
	pibe_id = str(profile.get("pibe_id", ""))
	club_id = str(profile.get("club_id", ""))
	var pibe_resp = await NakamaService.client.read_storage_objects_async(session, [
		{"collection": StorageKeys.COL_PIBES, "key": StorageKeys.KEY_PIBE_MAIN, "user_id": session.user_id},
	])
	if not pibe_resp.is_exception() and pibe_resp.objects.size() > 0:
		var pibe_raw = JSON.parse_string(pibe_resp.objects[0].value)
		if typeof(pibe_raw) == TYPE_DICTIONARY:
			pibe_name = str(pibe_raw.get("name", ""))
	var club_resp = await NakamaService.client.read_storage_objects_async(session, [
		{"collection": StorageKeys.COL_CLUBS, "key": club_id, "user_id": StorageKeys.SYSTEM_USER_ID},
	])
	if not club_resp.is_exception() and club_resp.objects.size() > 0:
		var club_raw = JSON.parse_string(club_resp.objects[0].value)
		if typeof(club_raw) == TYPE_DICTIONARY:
			club_name = str(club_raw.get("lunfardo_name", ""))
			club_division = str(club_raw.get("division", ""))
	profile_loaded.emit()
	return {"ok": true}
