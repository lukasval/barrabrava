extends Control

# TutorialScreen — 6-step state machine per UI-SPEC §5.8 + §10.
# [OVERRIDE Phase 1]: Replaces single-step CTA with full tap-through walkthrough.
#
# CRITICAL — elapsed_ms telemetry:
# tutorial_start_at_ms is captured in _ready() so elapsed_ms measures the FULL
# time the user spends in the tutorial, not just since the last step.
# LAB-TUTORIAL-DURATION invariant (plan 03.05): server logs tutorial_duration_ms
# at step 6; assertion: tutorial_duration_ms < 600000 (10 min = ONB-05 target).
#
# v1 tutorial is tap-through-only (locked decision per UI-SPEC §10 + plan objective).
# Step 2 (recruit) and step 5 (turno) are acknowledgement screens.
# Real first recruit + turno happen post-tutorial via HomeScreen guided hints.

@onready var step_indicator: Label = $TopBar/StepIndicator
@onready var skip_button: Button = $TopBar/Skip
@onready var step_title: Label = $Content/Title
@onready var step_body: RichTextLabel = $Content/Body
@onready var step_illustration: Control = $Content/Illustration
@onready var dots: HBoxContainer = $Content/Dots
@onready var back_button: Button = $Footer/Back
@onready var cta_button: Button = $Footer/CTA

# 6-step definition — UI-SPEC §10 verbatim.
const STEPS: Array = [
	{
		"id":  "welcome",
		"title": "Bienvenido a la barra",
		"body": "Tu pibé llegó al barrio. Te vamos a mostrar el laburo en 5 pasos.",
		"cta": "Dale, vamos",
	},
	{
		"id":  "recruit_intro",
		"title": "Sumá tu primer pibé",
		"body": "Cada día llegan 3 pibes nuevos al barrio. Elegí uno para sumarse a tu barra.",
		"cta": "Ir a reclutar",
	},
	{
		"id":  "assign_profession",
		"title": "Ponelo a laburar",
		"body": "Tu pibé puede laburar de trapito, vendedor, patovica o remisero. Genera Plata mientras vos no estás.",
		"cta": "Asignar profesión",
	},
	{
		"id":  "see_plata",
		"title": "Cobrá la Plata",
		"body": "Cada hora que tu pibé labura, suma Plata al tope. Cobrala cuando vuelvas. Cap: 12 horas.",
		"cta": "Entendido",
	},
	{
		"id":  "first_turno",
		"title": "Hacé tu primer turno",
		"body": "Cuando tu club juega, abrí la ventana y mandá a tus pibes al estadio. Eso le suma Aguante al pozo grupal.",
		"cta": "Hacer turno (simulado)",
	},
	{
		"id":  "reward",
		"title": "Bienvenida con regalo",
		"body": "Para arrancar bien, te damos tu primer trapo y un cántico. Aplaudila al equipo.",
		"cta": "Empezar de verdad",
	},
]

var _step: int = 1
# CRITICAL: capture start timestamp on first render; elapsed_ms measures full tutorial duration.
var tutorial_start_at_ms: int = 0

func _ready() -> void:
	# Capture start time immediately — LAB-TUTORIAL-DURATION invariant in plan 03.05.
	tutorial_start_at_ms = int(Time.get_unix_time_from_system() * 1000)
	skip_button.pressed.connect(_on_skip)
	back_button.pressed.connect(_on_back)
	cta_button.pressed.connect(_on_cta)
	_render_step()

func _elapsed_ms() -> int:
	return int(Time.get_unix_time_from_system() * 1000) - tutorial_start_at_ms

func _render_step() -> void:
	var info = STEPS[_step - 1]
	step_indicator.text = "Paso %d de %d" % [_step, STEPS.size()]
	step_title.text = info["title"]
	step_body.text = info["body"]
	cta_button.text = info["cta"]
	back_button.visible = (_step > 1)
	_render_dots()

func _render_dots() -> void:
	for i in range(dots.get_child_count()):
		var dot: ColorRect = dots.get_child(i)
		if dot:
			dot.color = AppTheme.ACCENT if i + 1 == _step else AppTheme.BORDER_INACTIVE

func _on_cta() -> void:
	cta_button.disabled = true
	match _step:
		1:
			# Step 1: client-only welcome ack. No server call.
			_step = 2
			_render_step()
			cta_button.disabled = false
		2:
			# Step 2: acknowledgement of recruit mechanic.
			# v1 tap-through: does NOT actually recruit a pibe mid-tutorial.
			await FlowRouter.tutorial_advance(2, _elapsed_ms())
			_step = 3
			_render_step()
			cta_button.disabled = false
		3:
			# Step 3: acknowledgement of profession mechanic.
			await FlowRouter.tutorial_advance(3, _elapsed_ms())
			_step = 4
			_render_step()
			cta_button.disabled = false
		4:
			# Step 4: acknowledgement of idle collect. Fire collect_idle for
			# tutorial bypass path (+10 Plata starter grant via server plan 03.03).
			await NakamaService.collect_idle()
			await FlowRouter.tutorial_advance(4, _elapsed_ms())
			_step = 5
			_render_step()
			cta_button.disabled = false
		5:
			# Step 5: simulated turno acknowledgement.
			# v1 tap-through: does NOT submit_turno mid-tutorial.
			# Server credits +20 Rep via tutorial bypass in complete_tutorial.
			await FlowRouter.tutorial_advance(5, _elapsed_ms())
			_step = 6
			_render_step()
			cta_button.disabled = false
		6:
			# FINAL step: grant trapo + cántico atomically + set tutorial_done = true.
			# Server logs tutorial_duration_ms at this step (LAB-TUTORIAL-DURATION invariant).
			# FlowRouter.tutorial_advance routes to HomeScreen when tutorial_done is set.
			await FlowRouter.tutorial_advance(6, _elapsed_ms())
			# FlowRouter go_home() is called inside tutorial_advance when tutorial_done == true.
			# If for any reason FlowRouter doesn't route (network error), re-enable CTA.
			cta_button.disabled = false

func _on_back() -> void:
	if _step > 1:
		_step -= 1
		_render_step()

func _on_skip() -> void:
	var dlg = ConfirmationDialog.new()
	dlg.dialog_text = "¿Saltar el tutorial? Vas a perderte la recompensa de bienvenida."
	dlg.ok_button_text = "Sí, saltar"
	dlg.cancel_button_text = "Seguir"
	add_child(dlg)
	dlg.confirmed.connect(func():
		# Mark tutorial done server-side. elapsed_ms captures time spent before skipping.
		# Server logs the (short) duration — informational only (T-3-UIB-05: accept).
		await FlowRouter.tutorial_advance(6, _elapsed_ms())
	)
	dlg.popup_centered()
