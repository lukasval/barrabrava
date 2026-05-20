extends Control

# ProfessionAssignScreen — pick which profession a pibé works.
# UI-SPEC §5.5. 5 profession rows + Líder-gated hablar_cana row (D-07).
# T-3-UIB-02: UI shows row visible-but-disabled for non-Líder; server re-validates.
# T-3-UIB-09: CTA disabled-during-RPC pattern.

const SCREEN_TITLE := "Asignar profesión"

@onready var back_button: Button = $TopBar/BackButton
@onready var header_label: Label = $Header/HeaderLabel
@onready var scroll: ScrollContainer = $ScrollContainer
@onready var rows_box: VBoxContainer = $ScrollContainer/VBox
@onready var error_label: Label = $ErrorLabel

var _pibe_id: String = ""
var _pibe_name: String = ""
var _assigning := false

# Profession list with rates and Líder gate flag.
const PROFESSIONS := [
	{"key": "trapito",     "label": "Trapito",     "rate": "Genera 10 Plata/h"},
	{"key": "vendedor",    "label": "Vendedor",     "rate": "Genera 15 Plata/h"},
	{"key": "patovica",    "label": "Patovica",     "rate": "Genera 12 Plata/h"},
	{"key": "remisero",    "label": "Remisero",     "rate": "Genera 8 Plata/h"},
	{"key": "hablar_cana", "label": "Hablar cana",  "rate": "+1 VBC/h", "lider_only": true},
]

func _ready() -> void:
	back_button.text = "‹ Atrás"
	back_button.pressed.connect(func(): FlowRouter.go_to("res://scenes/PibeDetailScreen.tscn"))
	if error_label:
		error_label.visible = false

	_pibe_id = str(PlayerStore.get_meta("nav_pibe_id", ""))

	# Find pibe name.
	for p in PlayerStore.pibes:
		if str(p.get("id", "")) == _pibe_id:
			var raw_name = p.get("display_name", null)
			_pibe_name = str(raw_name) if raw_name != null and str(raw_name) != "" else "este pibé"
			break

	if header_label:
		header_label.text = "%s va a laburar de:" % _pibe_name

	_build_profession_rows()

func _build_profession_rows() -> void:
	for child in rows_box.get_children():
		child.queue_free()

	# Find pibe skills for skill preview.
	var pibe_data: Dictionary = {}
	for p in PlayerStore.pibes:
		if str(p.get("id", "")) == _pibe_id:
			pibe_data = p
			break
	var skills = pibe_data.get("skills", {})

	var player_rank = PlayerStore.rank.to_lower()
	var is_lider = (player_rank == "lider")

	for prof in PROFESSIONS:
		var key = prof["key"]
		var label = prof["label"]
		var rate = prof["rate"]
		var lider_only = prof.get("lider_only", false)

		var row = _build_row(key, label, rate, skills, lider_only, is_lider)
		rows_box.add_child(row)

func _build_row(key: String, label: String, rate: String, skills: Dictionary, lider_only: bool, is_lider: bool) -> PanelContainer:
	var row = PanelContainer.new()
	var row_sb = StyleBoxFlat.new()
	row_sb.bg_color = AppTheme.SECONDARY
	row_sb.corner_radius_top_left = 8
	row_sb.corner_radius_top_right = 8
	row_sb.corner_radius_bottom_left = 8
	row_sb.corner_radius_bottom_right = 8
	row_sb.content_margin_left = 16
	row_sb.content_margin_right = 16
	row_sb.content_margin_top = 16
	row_sb.content_margin_bottom = 16
	row.add_theme_stylebox_override("panel", row_sb)
	row.custom_minimum_size.y = 72

	var hbox = HBoxContainer.new()
	hbox.theme_override_constants_separation = 12
	row.add_child(hbox)

	# ProfessionIcon placeholder (40x40).
	var icon = PanelContainer.new()
	icon.custom_minimum_size = Vector2(40, 40)
	var icon_sb = StyleBoxFlat.new()
	icon_sb.bg_color = _get_profession_color(key)
	icon_sb.corner_radius_top_left = 6
	icon_sb.corner_radius_top_right = 6
	icon_sb.corner_radius_bottom_left = 6
	icon_sb.corner_radius_bottom_right = 6
	icon.add_theme_stylebox_override("panel", icon_sb)
	hbox.add_child(icon)

	# Info VBox.
	var vbox = VBoxContainer.new()
	vbox.theme_override_constants_separation = 2
	vbox.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	hbox.add_child(vbox)

	var name_lbl = Label.new()
	name_lbl.text = label
	name_lbl.add_theme_font_size_override("font_size", 16)
	vbox.add_child(name_lbl)

	var rate_lbl = Label.new()
	rate_lbl.text = rate
	rate_lbl.add_theme_font_size_override("font_size", 14)
	rate_lbl.add_theme_color_override("font_color", AppTheme.TEXT_SECONDARY)
	vbox.add_child(rate_lbl)

	# Skill preview.
	var hours = int(skills.get(key + "_hours", 0))
	var multiplier := 1.0 + float(hours / 100) * 0.1
	var skill_lbl = Label.new()
	skill_lbl.text = "Skill actual: %dh → Multiplicador %.1f×" % [hours, multiplier]
	skill_lbl.add_theme_font_size_override("font_size", 14)
	skill_lbl.add_theme_color_override("font_color", AppTheme.TEXT_SECONDARY)
	vbox.add_child(skill_lbl)

	# Líder-only badge if applicable.
	if lider_only:
		var badge_lbl = Label.new()
		badge_lbl.text = "Solo Líder"
		badge_lbl.add_theme_font_size_override("font_size", 14)
		badge_lbl.add_theme_color_override("font_color", AppTheme.RANK_LIDER)
		vbox.add_child(badge_lbl)

	# Chevron.
	var chevron = Label.new()
	chevron.text = "›"
	chevron.add_theme_font_size_override("font_size", 20)
	chevron.add_theme_color_override("font_color", AppTheme.TEXT_SECONDARY)
	hbox.add_child(chevron)

	# Gating.
	if lider_only and not is_lider:
		row.modulate.a = 0.4
		# Gate label below.
		var gate_lbl = Label.new()
		gate_lbl.text = "Esta profesión es solo para el Líder de la barra."
		gate_lbl.add_theme_font_size_override("font_size", 14)
		gate_lbl.add_theme_color_override("font_color", AppTheme.TEXT_SECONDARY)
		gate_lbl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		vbox.add_child(gate_lbl)
		# Non-Líder: row is non-interactive.
	else:
		# Tappable row.
		row.mouse_filter = Control.MOUSE_FILTER_STOP
		row.gui_input.connect(func(event): _on_row_input(event, key, label))

	return row

func _on_row_input(event: InputEvent, prof_key: String, prof_label: String) -> void:
	var tapped := false
	if event is InputEventScreenTouch and event.pressed:
		tapped = true
	elif event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		tapped = true
	if not tapped:
		return
	if _assigning:
		return
	_confirm_assign(prof_key, prof_label)

func _confirm_assign(prof_key: String, prof_label: String) -> void:
	var dlg = ConfirmationDialog.new()
	dlg.dialog_text = "¿Asignar a %s como %s? Empieza a generar Plata ya." % [_pibe_name, prof_label]
	dlg.ok_button_text = "Confirmar"
	dlg.cancel_button_text = "Cancelar"
	add_child(dlg)
	dlg.confirmed.connect(func(): _perform_assign(prof_key))
	dlg.popup_centered()

func _perform_assign(prof_key: String) -> void:
	if _assigning:
		return
	_assigning = true
	if error_label:
		error_label.visible = false

	var resp = await NakamaService.assign_profession(_pibe_id, prof_key)
	_assigning = false

	if not resp.get("ok", false):
		var err = str(resp.get("error", ""))
		var msg: String
		if "lider_only" in err or "lider only" in err.to_lower():
			msg = "Esta profesión es solo para el Líder de la barra."
		elif "pibe_not_found" in err:
			msg = "No encontramos a ese pibé. Volvé al roster."
		else:
			msg = "No pudimos guardar la profesión. Probá de nuevo."
		if error_label:
			error_label.text = msg
			error_label.visible = true
		return

	# Update pibe in PlayerStore.
	var data = resp.get("data", {})
	for i in range(PlayerStore.pibes.size()):
		if str(PlayerStore.pibes[i].get("id", "")) == _pibe_id:
			PlayerStore.pibes[i] = data.get("pibe", PlayerStore.pibes[i])
			break
	PlayerStore.roster_updated.emit()

	# Back to PibeDetailScreen.
	FlowRouter.go_to("res://scenes/PibeDetailScreen.tscn")

func _get_profession_color(key: String) -> Color:
	match key:
		"trapito":     return AppTheme.PROF_TRAPITO
		"vendedor":    return AppTheme.PROF_VENDEDOR
		"patovica":    return AppTheme.PROF_PATOVICA
		"remisero":    return AppTheme.PROF_REMISERO
		"hablar_cana": return AppTheme.PROF_HABLAR_CANA
		_:             return AppTheme.PROF_SIN_LABURO
