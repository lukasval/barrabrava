extends PanelContainer

# Turno modal per UI-SPEC §5.7 + §6 modal section.
# Multi-select pibes + aporte estimado label + Confirmar/Cancelar.
# show_modal(current_window_dict) populates from PlayerStore.pibes.
# Confirms via NakamaService.submit_turno(fixture_id, pibe_ids).
# T-3-UIA-04: CTA disabled-during-RPC pattern.
# D-06: aporte = +50 Aguante × N + +20 Rep × N per selected pibé.

signal turno_submitted(result)
signal modal_closed

@onready var _title_label: Label = $VBox/Header/Title
@onready var _subtitle_label: Label = $VBox/Header/Subtitle
@onready var _pibe_rows: VBoxContainer = $VBox/Body/Scroll/PibeRows
@onready var _aporte_label: Label = $VBox/Footer/AporteLabel
@onready var _confirm_btn: Button = $VBox/Footer/Buttons/ConfirmBtn
@onready var _cancel_btn: Button = $VBox/Footer/Buttons/CancelBtn

var _fixture_id: String = ""
var _selected_ids: Array = []
var _eligible_pibes: Array = []

const AGUANTE_PER_PIBE := 50  # D-06
const REP_PER_PIBE     := 20  # D-06

func _ready() -> void:
	visible = false
	mouse_filter = Control.MOUSE_FILTER_STOP
	if _confirm_btn:
		_confirm_btn.pressed.connect(_on_confirm_pressed)
	if _cancel_btn:
		_cancel_btn.pressed.connect(_on_cancel_pressed)

func show_modal(current_window: Dictionary) -> void:
	_fixture_id = str(current_window.get("fixture_id", ""))
	_selected_ids.clear()
	var now_ts := int(Time.get_unix_time_from_system())
	_eligible_pibes.clear()
	var greyed_pibes: Array = []
	for pibe in PlayerStore.pibes:
		var energia = int(pibe.get("energia", 0))
		var turno_until = pibe.get("en_turno_until", null)
		var still_in_turno := false
		if turno_until != null and str(turno_until) != "null":
			still_in_turno = int(str(turno_until)) > now_ts
		if energia >= 30 and not still_in_turno:
			_eligible_pibes.append(pibe)
		else:
			greyed_pibes.append(pibe)
	_populate_rows(_eligible_pibes, greyed_pibes)
	_refresh_aporte()
	if _title_label:
		_title_label.text = "Hacer turno"
	if _subtitle_label:
		var window_type = str(current_window.get("type", ""))
		_subtitle_label.text = "Seleccioná los pibes para la cancha" + (" — Superclásico!" if window_type == "superclas" else "")
	visible = true

func _populate_rows(eligible: Array, greyed: Array) -> void:
	if not _pibe_rows:
		return
	for child in _pibe_rows.get_children():
		child.queue_free()
	for pibe in eligible:
		var row = _make_pibe_row(pibe, false)
		_pibe_rows.add_child(row)
	if greyed.size() > 0:
		var sep = Label.new()
		sep.text = "Ya en la cancha o sin energía:"
		sep.add_theme_font_size_override("font_size", 14)
		sep.add_theme_color_override("font_color", AppTheme.TEXT_SECONDARY)
		_pibe_rows.add_child(sep)
		for pibe in greyed:
			var row = _make_pibe_row(pibe, true)
			_pibe_rows.add_child(row)

func _make_pibe_row(pibe: Dictionary, greyed: bool) -> HBoxContainer:
	var row := HBoxContainer.new()
	row.theme_override_constants_separation = 8
	if greyed:
		row.modulate.a = 0.5

	var cb := CheckBox.new()
	cb.disabled = greyed
	var pibe_id := str(pibe.get("id", ""))
	cb.toggled.connect(func(on): _on_row_toggled(on, pibe_id))
	row.add_child(cb)

	var avatar := ColorRect.new()
	avatar.custom_minimum_size = Vector2(40, 40)
	avatar.color = Color(str(pibe.get("club_color", "#555555")))
	row.add_child(avatar)

	var name_lbl := Label.new()
	var raw_name = pibe.get("display_name", null)
	name_lbl.text = str(raw_name) if raw_name != null and str(raw_name) != "" else "Capo de la Barra"
	name_lbl.add_theme_font_size_override("font_size", 16)
	name_lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(name_lbl)

	var energia := int(pibe.get("energia", 0))
	var energia_bar := ProgressBar.new()
	energia_bar.custom_minimum_size = Vector2(60, 8)
	energia_bar.max_value = 100
	energia_bar.value = energia
	energia_bar.show_percentage = false
	var fill_sb = StyleBoxFlat.new()
	fill_sb.bg_color = AppTheme.get_energia_color(energia)
	energia_bar.add_theme_stylebox_override("fill", fill_sb)
	energia_bar.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	row.add_child(energia_bar)

	var cost_lbl := Label.new()
	cost_lbl.text = "−40"
	cost_lbl.add_theme_font_size_override("font_size", 14)
	cost_lbl.add_theme_color_override("font_color", AppTheme.TRAIT_NEGATIVE)
	row.add_child(cost_lbl)

	return row

func _on_row_toggled(on: bool, pibe_id: String) -> void:
	if on:
		if not _selected_ids.has(pibe_id):
			_selected_ids.append(pibe_id)
	else:
		_selected_ids.erase(pibe_id)
	_refresh_aporte()

func _refresh_aporte() -> void:
	if not _aporte_label:
		return
	var n := _selected_ids.size()
	if n == 0:
		_aporte_label.text = "Seleccioná pibes para ver el aporte"
	else:
		var aguante = n * AGUANTE_PER_PIBE
		var rep = n * REP_PER_PIBE
		_aporte_label.text = "Aporte estimado: +%d Aguante · +%d Rep" % [aguante, rep]
	if _confirm_btn:
		_confirm_btn.disabled = _selected_ids.size() == 0

func _on_confirm_pressed() -> void:
	if _selected_ids.is_empty():
		return
	if _confirm_btn:
		_confirm_btn.disabled = true  # T-3-UIA-04: disable during RPC
	if _cancel_btn:
		_cancel_btn.disabled = true
	var result = await NakamaService.submit_turno(_fixture_id, _selected_ids)
	if _confirm_btn:
		_confirm_btn.disabled = false
	if _cancel_btn:
		_cancel_btn.disabled = false
	turno_submitted.emit(result)
	visible = false
	modal_closed.emit()

func _on_cancel_pressed() -> void:
	visible = false
	modal_closed.emit()
