extends Node

# Manages Nakama session lifecycle: persist, restore, refresh.
# Session is stored in user://session.cfg via ConfigFile (Phase 1 — not Keychain).
#
# RESEARCH §1 ASSUMED A1: field name is `session.token`. If Plan 03 auth tests
# fail, swap to `session.auth_token` and document the decision.

const SESSION_FILE := "user://session.cfg"

signal session_ready(session)
signal session_cleared

var session  # NakamaSession instance or null

func _ready() -> void:
	await get_tree().process_frame  # wait for NakamaClient autoload to init
	await _try_restore_session()

func login(email: String, password: String) -> Dictionary:
	var result = await NakamaService.client.authenticate_email_async(email, password, null, false)
	if result.is_exception():
		return {"ok": false, "error": str(result.get_exception().message)}
	session = result
	_save_session()
	session_ready.emit(session)
	return {"ok": true}

func register(email: String, password: String) -> Dictionary:
	var result = await NakamaService.client.authenticate_email_async(email, password, null, true)
	if result.is_exception():
		return {"ok": false, "error": str(result.get_exception().message)}
	session = result
	_save_session()
	session_ready.emit(session)
	return {"ok": true}

func logout() -> void:
	# WR-04 fix: borrar el session file directamente vía DirAccess sobre el path
	# user://, sin truncate redundante ni globalize_path (que es frágil en web/HTML5).
	session = null
	if FileAccess.file_exists(SESSION_FILE):
		DirAccess.remove_absolute(SESSION_FILE)
	session_cleared.emit()

func is_authenticated() -> bool:
	return session != null and not session.expired

# Phase 3 fix: refresh the session in-place when expired. Call this from any
# RPC wrapper BEFORE `is_authenticated()` so an expired-but-refreshable token
# does not appear as "not_authenticated" to the user. Returns true if the
# session is fresh (either was already, or was refreshed successfully).
# Returns false if no session, no refresh token, or refresh itself failed.
func ensure_fresh_session() -> bool:
	if session == null:
		return false
	if not session.expired:
		return true
	# Session expired — try refresh via the persisted refresh_token (also
	# accessible from the in-memory session object).
	var refresh_token := str(session.refresh_token) if session.refresh_token != null else ""
	if refresh_token == "":
		print("[AuthManager] session expired, no refresh token available — must re-login")
		return false
	print("[AuthManager] session expired, refreshing...")
	var refreshed = await NakamaService.client.session_refresh_async(session, refresh_token)
	if refreshed.is_exception():
		push_warning("[AuthManager] refresh failed: %s" % refreshed.get_exception().message)
		return false
	session = refreshed
	_save_session()
	print("[AuthManager] session refreshed ok, new expiry in %d seconds" % int(session.expire_time - Time.get_unix_time_from_system()))
	return true

func _save_session() -> void:
	var cfg = ConfigFile.new()
	cfg.set_value("auth", "token", session.token)
	cfg.set_value("auth", "refresh_token", session.refresh_token)
	cfg.save(SESSION_FILE)
	print("[AuthManager] session saved")

# Added in Plan 04 Task 2 (D-03 UI entry point — ForgotPasswordScreen).
# Unauthenticated RPC: Nakama allows server-key auth for public RPCs by
# passing a null session. Server returns ok:true uniformly for
# anti-enumeration (Plan 03 T-1-RT-02), so the client treats any non-exception
# response as success and shows a uniform confirmation message.
func request_password_reset(email: String) -> Dictionary:
	var payload = JSON.stringify({"email": email.strip_edges()})
	var resp = await NakamaService.client.rpc_async(null, "request_password_reset", payload)
	if resp.is_exception():
		return {"ok": false, "error": str(resp.get_exception().message)}
	return {"ok": true}

func _try_restore_session() -> void:
	# CR-03 fix: SIEMPRE emitir un signal terminal (session_ready o session_cleared)
	# para que SplashScreen no espere los 3 segundos completos cuando no hay sesión.
	var cfg = ConfigFile.new()
	if cfg.load(SESSION_FILE) != OK:
		print("[AuthManager] no saved session")
		session_cleared.emit()
		return
	var token = cfg.get_value("auth", "token", "")
	var refresh = cfg.get_value("auth", "refresh_token", "")
	if token == "":
		session_cleared.emit()
		return
	var restored = NakamaService.client.restore_session(token)
	if restored.expired:
		if refresh == "":
			print("[AuthManager] session expired, no refresh token")
			session_cleared.emit()
			return
		var refreshed = await NakamaService.client.session_refresh_async(restored, refresh)
		if refreshed.is_exception():
			print("[AuthManager] refresh failed: %s" % refreshed.get_exception().message)
			session_cleared.emit()
			return
		session = refreshed
	else:
		session = restored
	_save_session()
	session_ready.emit(session)
	print("[AuthManager] session restored, user_id=%s" % session.user_id)
