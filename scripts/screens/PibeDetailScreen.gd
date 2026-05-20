extends Control

# PibeDetailScreen — full profile of one pibé. Action surface.
# UI-SPEC §5.4. Reads nav_pibe_id from PlayerStore meta (set by FlowRouter.go_pibe_detail).
# Three CTAs: Asignar profesión / Enviar a turno / Liberar pibé (Phase 4 — hidden).
# T-3-UIB-09: CTA disabled-during-RPC pattern.

@onready var back_button: Button = $TopBar/BackButton
@onready var avatar: ColorRect = $ScrollContainer/VBox/HeroSection/Avatar
@onready var name_label: Label = $ScrollContainer/VBox/HeroSection/Name
@onready var rol_label: Label = $ScrollContainer/VBox/HeroSection/RolLabel
@onready var trait1: PanelContainer = $ScrollContainer/VBox/TraitsRow/Trait1
@onready var trait2: PanelContainer = $ScrollContainer/VBox/TraitsRow/Trait2
@onready var energia_bar: ProgressBar = $ScrollContainer/VBox/EnergiaSection/EnergiaBar
@onready var energia_label: Label = $ScrollContainer/VBox/EnergiaSection/EnergiaLabel
@onready var skills_box: VBoxContainer = $ScrollContainer/VBox/SkillsSection/SkillsBox
@onready var skills_empty_label: Label = $ScrollContainer/VBox/SkillsSection/SkillsEmptyLabel
@onready var assignment_label: Label = $ScrollContainer/VBox/CurrentAssignment/AssignLabel
@onready var assign_btn: Button = $ActionsRow/AssignBtn
@onready var turno_btn: Button = $ActionsRow/TurnoBtn
# Liberar pibé — Phase 4 ships release_pibe RPC.
# Hidden in Phase 3. Button kept in tscn but visible=false.

var _pibe_data: Dictionary = {}
var _pibe_id: String = ""

func _ready() -> void:
	back_button.text = "‹ Atrás"
	back_button.pressed.connect(func(): FlowRouter.go_roster())
	assign_btn.pressed.connect(_on_assign_pressed)
	turno_btn.pressed.connect(_on_turno_pressed)

	# Load pibe from PlayerStore.pibes by nav_pibe_id.
	_pibe_id = str(PlayerStore.get_meta("nav_pibe_id", ""))
	var found := false
	for p in PlayerStore.pibes:
		if str(p.get("id", "")) == _pibe_id:
			_pibe_data = p
			found = true
			break

	if not found:
		# Pibe not in cached roster — re-fetch.
		await _reload_pibe()
	else:
		_render_pibe()

func _reload_pibe() -> void:
	var resp = await NakamaService.get_roster()
	if resp.get("ok", false):
		var data = resp.get("data", {})
		PlayerStore.pibes = data.get("pibes", [])
		PlayerStore.roster_updated.emit()
		for p in PlayerStore.pibes:
			if str(p.get("id", "")) == _pibe_id:
				_pibe_data = p
				break
	_render_pibe()

func _render_pibe() -> void:
	if _pibe_data.is_empty():
		name_label.text = "No pudimos cargar a este pibé."
		return

	# Hero section.
	var raw_name = _pibe_data.get("display_name", null)
	name_label.text = str(raw_name) if raw_name != null and str(raw_name) != "" else "Capo de la Barra"

	var profession = _pibe_data.get("profession", null)
	var rol = str(_pibe_data.get("rol", ""))
	if profession != null and str(profession) != "" and str(profession) != "null":
		rol_label.text = str(profession).replace("_", " ").capitalize()
	elif rol != "":
		rol_label.text = rol.replace("_", " ").capitalize()
	else:
		rol_label.text = "Sin laburo"

	# Avatar tint.
	var club_color = str(_pibe_data.get("club_color", "#888888"))
	avatar.color = Color(club_color)

	# Traits.
	var traits = _pibe_data.get("traits", [])
	var t1 = traits[0] if traits.size() > 0 else {}
	var t2 = traits[1] if traits.size() > 1 else {}
	if trait1 and trait1.has_method("set_trait"):
		if t1.size() > 0:
			trait1.set_trait(str(t1.get("id", "")), str(t1.get("sentiment", "neutral")), str(t1.get("label", "")))
			trait1.visible = true
		else:
			trait1.visible = false
	if trait2 and trait2.has_method("set_trait"):
		if t2.size() > 0:
			trait2.set_trait(str(t2.get("id", "")), str(t2.get("sentiment", "neutral")), str(t2.get("label", "")))
			trait2.visible = true
		else:
			trait2.visible = false

	# Energía.
	var energia = int(_pibe_data.get("energia", 100))
	energia_bar.value = energia
	var fill_sb = StyleBoxFlat.new()
	fill_sb.bg_color = AppTheme.get_energia_color(energia)
	fill_sb.corner_radius_top_left = 4
	fill_sb.corner_radius_top_right = 4
	fill_sb.corner_radius_bottom_left = 4
	fill_sb.corner_radius_bottom_right = 4
	energia_bar.add_theme_stylebox_override("fill", fill_sb)
	var track_sb = StyleBoxFlat.new()
	track_sb.bg_color = AppTheme.SECONDARY
	track_sb.corner_radius_top_left = 4
	track_sb.corner_radius_top_right = 4
	track_sb.corner_radius_bottom_left = 4
	track_sb.corner_radius_bottom_right = 4
	energia_bar.add_theme_stylebox_override("background", track_sb)
	energia_label.text = "%d/100 — Regenera +5/h" % energia

	# Skills section.
	_render_skills()

	# Current assignment.
	_render_assignment()

	# Turno button gating (window open + energia >= 30).
	_refresh_turno_button()

func _render_skills() -> void:
	for child in skills_box.get_children():
		child.queue_free()

	var skills = _pibe_data.get("skills", {})
	var has_skills := false
	const PROFESSION_NAMES := {
		"trapito": "Trapito",
		"vendedor": "Vendedor",
		"patovica": "Patovica",
		"remisero": "Remisero",
		"hablar_cana": "Hablar cana",
	}

	for prof_key in PROFESSION_NAMES:
		var hours_key = prof_key + "_hours"
		var hours = int(skills.get(hours_key, 0))
		if hours <= 0:
			continue
		has_skills = true
		var row = HBoxContainer.new()
		row.theme_override_constants_separation = 8

		# ProfessionIcon (40x40 placeholder).
		var icon_panel = PanelContainer.new()
		icon_panel.custom_minimum_size = Vector2(40, 40)
		var icon_sb = StyleBoxFlat.new()
		icon_sb.bg_color = _get_profession_color(prof_key)
		icon_sb.corner_radius_top_left = 6
		icon_sb.corner_radius_top_right = 6
		icon_sb.corner_radius_bottom_left = 6
		icon_sb.corner_radius_bottom_right = 6
		icon_panel.add_theme_stylebox_override("panel", icon_sb)
		row.add_child(icon_panel)

		# Name label.
		var name_lbl = Label.new()
		name_lbl.text = PROFESSION_NAMES[prof_key]
		name_lbl.add_theme_font_size_override("font_size", 16)
		name_lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(name_lbl)

		# Level label.
		var level = hours / 100
		var level_lbl = Label.new()
		level_lbl.text = "Nv. %d" % level
		level_lbl.add_theme_font_size_override("font_size", 14)
		level_lbl.add_theme_color_override("font_color", AppTheme.TEXT_SECONDARY)
		row.add_child(level_lbl)

		skills_box.add_child(row)

	if skills_empty_label:
		skills_empty_label.visible = not has_skills
		skills_empty_label.text = "Sin horas trabajadas todavía. Asignale una profesión."

func _get_profession_color(prof_key: String) -> Color:
	match prof_key:
		"trapito":     return AppTheme.PROF_TRAPITO
		"vendedor":    return AppTheme.PROF_VENDEDOR
		"patovica":    return AppTheme.PROF_PATOVICA
		"remisero":    return AppTheme.PROF_REMISERO
		"hablar_cana": return AppTheme.PROF_HABLAR_CANA
		_:             return AppTheme.PROF_SIN_LABURO

func _render_assignment() -> void:
	var profession = _pibe_data.get("profession", null)
	var turno_until = _pibe_data.get("en_turno_until", null)
	var now_ms := int(Time.get_unix_time_from_system() * 1000)
	var in_turno := turno_until != null and str(turno_until) != "null" and int(str(turno_until)) > now_ms

	if in_turno:
		var until_ts := int(str(turno_until)) / 1000
		var dt = Time.get_datetime_dict_from_unix_time(until_ts)
		assignment_label.text = "En turno hasta %02d:%02d" % [dt.get("hour", 0), dt.get("minute", 0)]
	elif profession != null and str(profession) != "" and str(profession) != "null":
		var prof_name = str(profession).replace("_", " ").capitalize()
		assignment_label.text = "Trabajando como %s" % prof_name
	else:
		assignment_label.text = "Descansando"

func _refresh_turno_button() -> void:
	var win = PlayerStore.current_window
	var window_open = typeof(win) == TYPE_DICTIONARY and (
		win.get("state", "") == "open" or win.get("state", "") == "live"
	)
	var energia = int(_pibe_data.get("energia", 0))
	turno_btn.disabled = not (window_open and energia >= 30)

func _on_assign_pressed() -> void:
	FlowRouter.go_profession_assign(_pibe_id)

func _on_turno_pressed() -> void:
	# Open TurnoModal pre-filtered to this pibe.
	var modal_scene = preload("res://scenes/TurnoModal.tscn")
	var modal = modal_scene.instantiate()
	add_child(modal)
	modal.show_modal(PlayerStore.current_window)
