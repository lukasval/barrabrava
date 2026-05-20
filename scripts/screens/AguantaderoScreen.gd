extends Control

# AguantaderoScreen — HQ visualization, upgrade panel, bandera-room placeholder.
# UI-SPEC §5.6. Upgrade confirmation dialog. Max level (5) handled gracefully.
# T-3-UIB-09: CTA disabled-during-RPC pattern.

@onready var back_button: Button = $TopBar/BackButton
@onready var hero_title: Label = $ScrollContainer/VBox/HeroBlock/Overlay/HeroTitle
@onready var hero_barrio: Label = $ScrollContainer/VBox/HeroBlock/Overlay/HeroBarrio
@onready var hero_illustration: ColorRect = $ScrollContainer/VBox/HeroBlock/AguantaderoIllustration
@onready var stat_cap: Label = $ScrollContainer/VBox/StatsRow/CapCard/Value
@onready var stat_aguante_pasivo: Label = $ScrollContainer/VBox/StatsRow/AguanteCard/Value
@onready var stat_prox_nivel: Label = $ScrollContainer/VBox/StatsRow/ProxNivelCard/Value
@onready var upgrade_panel: PanelContainer = $ScrollContainer/VBox/UpgradePanel
@onready var upgrade_title: Label = $ScrollContainer/VBox/UpgradePanel/VBox/UpgradeTitle
@onready var upgrade_body: Label = $ScrollContainer/VBox/UpgradePanel/VBox/UpgradeBody
@onready var upgrade_cost: Label = $ScrollContainer/VBox/UpgradePanel/VBox/UpgradeCost
@onready var upgrade_btn: Button = $ScrollContainer/VBox/UpgradePanel/VBox/UpgradeBtn
@onready var insufficient_label: Label = $ScrollContainer/VBox/UpgradePanel/VBox/InsufficientLabel
@onready var bandera_heading: Label = $ScrollContainer/VBox/BanderaRoomSection/BanderaHeading
@onready var bandera_grid: GridContainer = $ScrollContainer/VBox/BanderaRoomSection/BanderaGrid
@onready var bandera_empty_label: Label = $ScrollContainer/VBox/BanderaRoomSection/BanderaEmptyLabel
@onready var roster_cap_info: Label = $ScrollContainer/VBox/RosterCapInfo
@onready var error_banner: Label = $ErrorBanner

@onready var nav_inicio: Node = $BottomNav/NavInicio
@onready var nav_roster: Node = $BottomNav/NavRoster
@onready var nav_aguantadero: Node = $BottomNav/NavAguantadero
@onready var nav_reclutar: Node = $BottomNav/NavReclutar

# Aguantadero upgrade table (matches server plan 03.02 UPGRADE_COSTS).
const UPGRADE_TABLE := [
	{},  # level 0 (unused)
	{"cap": 5,  "aguante_pasivo": 0,   "cost": 5000,  "cap_delta": 3,  "aguante_delta": 0},
	{"cap": 8,  "aguante_pasivo": 0,   "cost": 15000, "cap_delta": 4,  "aguante_delta": 0},
	{"cap": 12, "aguante_pasivo": 0,   "cost": 40000, "cap_delta": 5,  "aguante_delta": 0},
	{"cap": 17, "aguante_pasivo": 0,   "cost": 80000, "cap_delta": 3,  "aguante_delta": 0},
	{"cap": 20, "aguante_pasivo": 0,   "cost": 0,     "cap_delta": 0,  "aguante_delta": 0},  # max
]
const MAX_LEVEL := 5

var _upgrading := false

func _ready() -> void:
	back_button.text = "‹ Atrás"
	back_button.pressed.connect(func(): FlowRouter.go_home())
	upgrade_btn.pressed.connect(_on_upgrade_pressed)
	bandera_heading.text = "Bandera room"
	bandera_empty_label.text = "Acá van a colgarse los trapos que robés. Por ahora, vacío."
	if error_banner:
		error_banner.visible = false

	# BottomNav.
	if nav_inicio and nav_inicio.has_signal("tapped"):
		nav_inicio.tapped.connect(func(): FlowRouter.go_home())
	if nav_roster and nav_roster.has_signal("tapped"):
		nav_roster.tapped.connect(func(): FlowRouter.go_roster())
	if nav_aguantadero and nav_aguantadero.has_signal("tapped"):
		nav_aguantadero.tapped.connect(func(): pass)  # already here
	if nav_reclutar and nav_reclutar.has_signal("tapped"):
		nav_reclutar.tapped.connect(func(): FlowRouter.go_recruit())

	await _load_aguantadero()

func _load_aguantadero() -> void:
	var resp = await NakamaService.get_aguantadero()
	if not resp.get("ok", false):
		if error_banner:
			error_banner.text = "No pudimos cargar tu aguantadero. Probá de nuevo."
			error_banner.visible = true
		return
	var data = resp.get("data", {})
	PlayerStore.aguantadero = data.get("aguantadero", {})
	PlayerStore.aguantadero_updated.emit()
	_render_aguantadero()

func _render_aguantadero() -> void:
	var agu = PlayerStore.aguantadero
	if agu.is_empty():
		return
	var level = int(agu.get("level", 1))
	var barrio = str(agu.get("barrio_name", agu.get("barrio_hq", "—")))
	var cap = int(agu.get("roster_cap", 5))
	var trapos: Array = agu.get("trapos", [])

	# Hero block.
	hero_title.text = "Aguantadero Nv. %d" % level
	hero_barrio.text = barrio

	# Stats row.
	stat_cap.text = "%d/20" % cap
	stat_aguante_pasivo.text = "+0/h"  # Phase 3: pasivo = 0 (deferred mechanic)

	# Upgrade panel.
	if level >= MAX_LEVEL:
		upgrade_title.text = "Nivel máximo"
		upgrade_body.text = "Estás al máximo. Más niveles llegan en próximas temporadas."
		upgrade_cost.visible = false
		upgrade_btn.visible = false
		if insufficient_label:
			insufficient_label.visible = false
		stat_prox_nivel.text = "Max"
	else:
		var next_level = level + 1
		var table_entry = UPGRADE_TABLE[level] if level < UPGRADE_TABLE.size() else {}
		var cost = int(table_entry.get("cost", 0))
		var cap_delta = int(table_entry.get("cap_delta", 0))
		var aguante_delta = int(table_entry.get("aguante_delta", 0))

		upgrade_title.text = "Subir a nivel %d" % next_level
		upgrade_body.text = "+%d pibes / +%d Aguante pasivo/h" % [cap_delta, aguante_delta]
		upgrade_cost.text = "Costo: %d Plata" % cost
		upgrade_cost.visible = true
		upgrade_btn.visible = true
		stat_prox_nivel.text = "%d Plata" % cost

		# Plata sufficiency check.
		if PlayerStore.plata < cost:
			upgrade_btn.disabled = true
			var diff = cost - PlayerStore.plata
			if insufficient_label:
				insufficient_label.text = "Te faltan %d de Plata." % diff
				insufficient_label.visible = true
		else:
			upgrade_btn.disabled = false
			if insufficient_label:
				insufficient_label.visible = false

	# Bandera room — 6 slots (3×2 grid). Post-tutorial slot 1 shows primer trapo.
	for child in bandera_grid.get_children():
		child.queue_free()

	for i in range(6):
		var slot = PanelContainer.new()
		slot.custom_minimum_size = Vector2(96, 144)
		var slot_sb = StyleBoxFlat.new()
		slot_sb.bg_color = AppTheme.SECONDARY
		slot_sb.corner_radius_top_left = 8
		slot_sb.corner_radius_top_right = 8
		slot_sb.corner_radius_bottom_left = 8
		slot_sb.corner_radius_bottom_right = 8
		slot_sb.border_width_left = 1
		slot_sb.border_width_right = 1
		slot_sb.border_width_top = 1
		slot_sb.border_width_bottom = 1
		slot_sb.border_color = AppTheme.BORDER_INACTIVE
		slot.add_theme_stylebox_override("panel", slot_sb)

		var slot_label = Label.new()
		# Slot 0 = primer trapo from tutorial reward if PlayerStore.cantico_unlocked != ""
		if i == 0 and PlayerStore.cantico_unlocked != "":
			slot_label.text = "Primer trapo"
		elif i < trapos.size():
			slot_label.text = str(trapos[i].get("name", "Trapo"))
		else:
			slot_label.text = "Vacío"
		slot_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		slot_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		slot_label.add_theme_font_size_override("font_size", 14)
		slot_label.add_theme_color_override("font_color", AppTheme.TEXT_SECONDARY)
		slot_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		slot_label.size_flags_vertical = Control.SIZE_EXPAND_FILL
		slot.add_child(slot_label)
		bandera_grid.add_child(slot)

	# Roster cap info.
	roster_cap_info.text = "Tu roster máximo es %d pibes según tu aguantadero nv. %d." % [cap, level]

func _on_upgrade_pressed() -> void:
	if _upgrading:
		return
	var agu = PlayerStore.aguantadero
	var level = int(agu.get("level", 1))
	var next_level = level + 1
	var table_entry = UPGRADE_TABLE[level] if level < UPGRADE_TABLE.size() else {}
	var cost = int(table_entry.get("cost", 0))

	var dlg = ConfirmationDialog.new()
	dlg.dialog_text = "¿Upgradear a nivel %d? Te cuesta %d Plata." % [next_level, cost]
	dlg.ok_button_text = "Confirmar"
	dlg.cancel_button_text = "Cancelar"
	add_child(dlg)
	dlg.confirmed.connect(func(): _perform_upgrade(next_level, cost))
	dlg.popup_centered()

func _perform_upgrade(target_level: int, cost: int) -> void:
	if _upgrading:
		return
	_upgrading = true
	upgrade_btn.disabled = true
	if error_banner:
		error_banner.visible = false

	var resp = await NakamaService.upgrade_aguantadero(target_level)
	_upgrading = false

	if not resp.get("ok", false):
		upgrade_btn.disabled = false
		var err = str(resp.get("error", ""))
		var msg: String
		if "plata_insufficient" in err or "not enough" in err.to_lower():
			msg = "Te faltan Plata para upgradear."
		else:
			msg = "No pudimos upgradear. Probá de nuevo."
		if error_banner:
			error_banner.text = msg
			error_banner.visible = true
		return

	# Success: update PlayerStore + re-render.
	var data = resp.get("data", {})
	PlayerStore.aguantadero = data.get("aguantadero", PlayerStore.aguantadero)
	PlayerStore.plata = max(0, PlayerStore.plata - cost)
	PlayerStore.roster_cap = int(PlayerStore.aguantadero.get("roster_cap", PlayerStore.roster_cap))
	PlayerStore.resources_updated.emit()
	PlayerStore.aguantadero_updated.emit()
	_render_aguantadero()
