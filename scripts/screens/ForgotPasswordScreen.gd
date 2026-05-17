extends Control

# D-03 UI entry — sends a password reset request via RPC.
# Anti-enumeration (T-1-UI-11 / Plan 03 T-1-RT-02): the client ALWAYS shows the
# same confirmation message regardless of whether the server found the email,
# and disables the form after the first submit to mirror server-side rate
# limiting (T-1-UI-12).

@onready var email_input: LineEdit = $VBox/EmailInput
@onready var submit_button: Button = $VBox/Submit
@onready var status_label: Label = $VBox/Status
@onready var back_link: RichTextLabel = $VBox/BackLink

func _ready() -> void:
	submit_button.text = "Enviar reseteo"
	submit_button.pressed.connect(_on_submit)
	back_link.text = "[url=back]← Volver a Entrar[/url]"
	back_link.meta_clicked.connect(_on_back_clicked)
	status_label.visible = false
	email_input.placeholder_text = "tu@correo.com"

func _on_back_clicked(_meta: Variant) -> void:
	FlowRouter.go_auth()

func _on_submit() -> void:
	var email := email_input.text.strip_edges()
	if email.length() == 0 or email.find("@") == -1:
		status_label.text = "Poné un email válido, chabón."
		status_label.add_theme_color_override("font_color", AppTheme.DESTRUCTIVE)
		status_label.visible = true
		return
	submit_button.disabled = true
	status_label.visible = false
	var _res = await AuthManager.request_password_reset(email)
	# Anti-enumeration: uniform success message regardless of server result.
	# Server already responds uniformly (Plan 03 T-1-RT-02); client respects
	# the contract so a logged response never leaks existence.
	status_label.text = "Si ese email está en la base, te llega un link en unos minutos. Revisá spam también."
	status_label.add_theme_color_override("font_color", AppTheme.TEXT_SECONDARY)
	status_label.visible = true
	# WR-06 fix: re-habilita el botón después de 30s para permitir retry si
	# hubo network failure real. El email_input queda editable así el usuario
	# puede corregir un typo. Anti-enumeration se mantiene: el mensaje es
	# uniforme y el server sigue respondiendo igual independiente del email.
	await get_tree().create_timer(30.0).timeout
	submit_button.disabled = false
	submit_button.text = "Enviar de nuevo"
