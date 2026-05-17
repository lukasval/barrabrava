extends Control

# Single-screen welcome per UI-SPEC §TutorialScreen (D-13 — no full tutorial).

@onready var cta: Button = $VBox/CTA

func _ready() -> void:
	cta.text = "Dale, empezamos"
	cta.pressed.connect(_on_cta)

func _on_cta() -> void:
	FlowRouter.go_home()
