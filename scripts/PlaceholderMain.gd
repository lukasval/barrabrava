extends Control

func _ready() -> void:
	print("[PlaceholderMain] ready")
	print("[PlaceholderMain] AppTheme.safe_area_top=%d" % AppTheme.safe_area_top)
	print("[PlaceholderMain] AuthManager.is_authenticated()=%s" % AuthManager.is_authenticated())
	print("[PlaceholderMain] NakamaService.client != null = %s" % (NakamaService.client != null))
