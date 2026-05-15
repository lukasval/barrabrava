class_name SafeArea
extends RefCounted

# Utility helpers for safe-area insets.
# Read AppTheme.safe_area_top / safe_area_bottom which are filled at boot.

static func apply_top(node: Control) -> void:
	if node and AppTheme:
		node.offset_top += AppTheme.safe_area_top

static func apply_bottom(node: Control) -> void:
	if node and AppTheme:
		node.offset_bottom -= AppTheme.safe_area_bottom
