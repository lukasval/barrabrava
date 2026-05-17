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

var pibe_id: String = ""
var pibe_name: String = ""
var club_id: String = ""
var club_name: String = ""

func has_profile() -> bool:
	return pibe_id != ""

func clear() -> void:
	pibe_id = ""
	pibe_name = ""
	club_id = ""
	club_name = ""
	profile_cleared.emit()

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
	var profile = JSON.parse_string(resp.objects[0].value)
	pibe_id = profile.get("pibe_id", "")
	club_id = profile.get("club_id", "")
	var pibe_resp = await NakamaService.client.read_storage_objects_async(session, [
		{"collection": StorageKeys.COL_PIBES, "key": StorageKeys.KEY_PIBE_MAIN, "user_id": session.user_id},
	])
	if not pibe_resp.is_exception() and pibe_resp.objects.size() > 0:
		var pibe = JSON.parse_string(pibe_resp.objects[0].value)
		pibe_name = pibe.get("name", "")
	var club_resp = await NakamaService.client.read_storage_objects_async(session, [
		{"collection": StorageKeys.COL_CLUBS, "key": club_id, "user_id": StorageKeys.SYSTEM_USER_ID},
	])
	if not club_resp.is_exception() and club_resp.objects.size() > 0:
		var club = JSON.parse_string(club_resp.objects[0].value)
		club_name = club.get("lunfardo_name", "")
	profile_loaded.emit()
	return {"ok": true}
