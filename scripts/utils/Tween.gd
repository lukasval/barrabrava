class_name TweenUtil
extends RefCounted

# Small helpers wrapping Godot's create_tween() for the UI-SPEC interaction
# contract. Keep this stateless — pass the target node + the host that owns
# the tween (usually the same Control).

const PRESS_SCALE := 0.95
const PRESS_DURATION := 0.08    # 80ms in / 80ms out per UI-SPEC §Interaction
const FADE_DURATION := 0.15     # 150ms per UI-SPEC §Screen Flow

# Subtle press-feel: scale 1.0 -> 0.95 -> 1.0 over 160ms total.
static func press(control: Control) -> void:
	if control == null or not is_instance_valid(control):
		return
	var t := control.create_tween()
	t.tween_property(control, "scale", Vector2(PRESS_SCALE, PRESS_SCALE), PRESS_DURATION)
	t.tween_property(control, "scale", Vector2.ONE, PRESS_DURATION)

# Fade a CanvasItem's modulate alpha from `from` to `to` over FADE_DURATION.
static func fade(node: CanvasItem, from: float, to: float) -> Signal:
	var t := node.create_tween()
	node.modulate.a = from
	t.tween_property(node, "modulate:a", to, FADE_DURATION)
	return t.finished
