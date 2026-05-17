extends Control

# Login + Registro tabs per UI-SPEC §AuthScreen.
# Login: AuthManager.login -> PlayerStore.load_from_server -> Home (if has profile) or ClubPicker.
# Registro: AuthManager.register -> ClubPicker (new account, no profile yet).
# Forgot link routes to ForgotPasswordScreen via FlowRouter (D-03 UI entry — CHK-02 fix).

@onready var tabs: TabContainer = $VBox/TabContainer
@onready var login_email: LineEdit = $VBox/TabContainer/Entrar/Email
@onready var login_password: LineEdit = $VBox/TabContainer/Entrar/Password
@onready var login_button: Button = $VBox/TabContainer/Entrar/Submit
@onready var login_error: Label = $VBox/TabContainer/Entrar/ErrorLabel
@onready var forgot_link: RichTextLabel = $VBox/TabContainer/Entrar/ForgotLink
@onready var reg_email: LineEdit = $VBox/TabContainer/Registrarse/Email
@onready var reg_password: LineEdit = $VBox/TabContainer/Registrarse/Password
@onready var reg_confirm: LineEdit = $VBox/TabContainer/Registrarse/Confirm
@onready var reg_button: Button = $VBox/TabContainer/Registrarse/Submit
@onready var reg_error: Label = $VBox/TabContainer/Registrarse/ErrorLabel
@onready var privacy_link: RichTextLabel = $VBox/TabContainer/Registrarse/PrivacyLink
@onready var accept_terms: CheckBox = $VBox/TabContainer/Registrarse/AcceptTerms

func _ready() -> void:
	tabs.set_tab_title(0, "Entrar")
	tabs.set_tab_title(1, "Registrarse")
	login_button.pressed.connect(_on_login)
	reg_button.pressed.connect(_on_register)
	privacy_link.meta_clicked.connect(_on_privacy_clicked)
	forgot_link.meta_clicked.connect(_on_forgot_clicked)
	accept_terms.toggled.connect(_on_accept_toggled)
	forgot_link.text = "[url=forgot]¿Olvidaste tu contraseña?[/url]"
	# PRV-05: explicit privacy + terms consent before account creation.
	privacy_link.text = "Antes de jugar: [url=%s]privacidad[/url] · [url=%s]términos[/url]" % [AppConfig.PRIVACY_URL, AppConfig.TERMS_URL]
	reg_button.disabled = true  # gated by accept_terms checkbox
	login_error.visible = false
	reg_error.visible = false

func _on_accept_toggled(pressed: bool) -> void:
	reg_button.disabled = not pressed

func _on_login() -> void:
	login_error.visible = false
	login_button.disabled = true
	var res = await AuthManager.login(login_email.text.strip_edges(), login_password.text)
	login_button.disabled = false
	if not res.ok:
		login_error.text = _humanize_error(res.error)
		login_error.visible = true
		return
	var profile = await PlayerStore.load_from_server()
	if profile.ok and PlayerStore.has_profile():
		FlowRouter.go_home()
	else:
		FlowRouter.go_club_picker()

func _on_register() -> void:
	reg_error.visible = false
	if not accept_terms.button_pressed:
		reg_error.text = "Tenés que aceptar privacidad + términos, chabón."
		reg_error.visible = true
		return
	if reg_password.text != reg_confirm.text:
		reg_error.text = "Las contraseñas no coinciden, chabón."
		reg_error.visible = true
		return
	if reg_password.text.length() < 8:
		reg_error.text = "Mínimo 8 caracteres, chabón."
		reg_error.visible = true
		return
	reg_button.disabled = true
	var res = await AuthManager.register(reg_email.text.strip_edges(), reg_password.text)
	reg_button.disabled = false
	if not res.ok:
		reg_error.text = _humanize_error(res.error)
		reg_error.visible = true
		return
	FlowRouter.go_club_picker()

func _humanize_error(err: String) -> String:
	var lower = err.to_lower()
	if "exist" in lower or "already" in lower:
		return "Ese mail ya está en la vuelta. Entrá con tu cuenta."
	if "invalid" in lower or "password" in lower or "credentials" in lower:
		return "Código equivocado, chabón. Probá de vuelta."
	if "network" in lower or "timeout" in lower or "connection" in lower:
		return "Sin conexión, chabón. Fijate el WiFi."
	return "Algo salió mal. Probá de nuevo."

func _on_privacy_clicked(meta: Variant) -> void:
	OS.shell_open(str(meta))

func _on_forgot_clicked(_meta: Variant) -> void:
	FlowRouter.go_forgot_password()
