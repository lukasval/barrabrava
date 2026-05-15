# Deferred: Mobile CI Builds → Phase 7

**Date deferred:** 2026-05-15
**Originally scoped in:** TEC-08 (Phase 1)
**Deferred to:** Phase 7 (Polish + Launch)
**Severity of deferral:** Acceptable for solo dev

---

## What was originally planned

TEC-08 in ROADMAP / REQUIREMENTS originally stated:
> "App buildea para iOS y Android desde GitHub Actions"

This implied both an Android APK CI workflow AND an iOS IPA CI workflow as Phase 1 outputs.

## What is actually delivered in Phase 1

**Neither iOS nor Android APK CI builds run automatically.** Both deferred to Phase 7.

Phase 1 delivers:
- `.github/workflows/build-android-debug.yml` exists in the repo but trigger is reduced to `workflow_dispatch` only (manual). It's wired for future re-enablement.
- iOS export preset intentionally NOT in `export_presets.cfg`.
- Local Godot 4.3 editor works for both platforms (manual builds).

## Why iOS deferred (original reason, still valid)

1. **GitHub Actions macOS runners cost ~10x more than Linux runners** (~$0.08/min vs $0.008/min). For a solo dev with a $40/mo budget, running macOS jobs on every push to develop is wasteful.
2. **No release/signing pipeline needed in Phase 1.** Phase 1 produces debug builds for the dev's own device, not store submission. Local Xcode export is sufficient.
3. **Provisioning profiles, certificates, and Fastlane match setup** all need to happen anyway as part of Phase 7 store submission. Doing them now and again at Phase 7 is duplicate work.
4. **Fastlane was already deferred to Phase 7 in CONTEXT.md** (Claude's Discretion section). iOS CI naturally pairs with Fastlane setup — they belong together.

## Why Android also deferred (added 2026-05-15)

After completing Plan 01-02 (Godot 4.3 skeleton), CI builds repeatedly failed with an empty `"Cannot export project with preset 'Android Debug' due to configuration errors:"` message from headless Godot — no specific error lines printed.

Investigation summary (all attempted fixes are in git history `04f85d2`, `7083b8c`, `81d3876`, `a72d753`, `29c9393`):

- ✓ `editor_settings-4.tres` correctly placed at `$HOME/.config/godot/`
- ✓ All 5 Android paths (`java_sdk_path`, `android_sdk_path`, `debug_keystore`, `debug_keystore_user`, `debug_keystore_pass`) verified set with correct values
- ✓ Debug keystore at `/root/debug.keystore` exists in `barichello/godot-ci:4.3` image
- ✓ Export templates at `/root/.local/share/godot/export_templates/4.3.stable/` include `android_debug.apk` (108 MB)
- ✓ Forced `HOME=/root` at job-env level so Godot reads the image's baked editor_settings
- ✓ Hardcoded `keystore/debug` + `keystore/debug_user` + `keystore/debug_password` in `export_presets.cfg`
- ✗ Despite all of the above, Godot 4.3 headless export emits `ERROR: Cannot export project with preset "Android Debug" due to configuration errors:` followed by an **empty error body**, then exits with code 1.

Recurrent warning during export: `"Could not find version of build tools that matches Target SDK, using 33.0.2"` — barichello image has Android SDK build-tools 33.0.2; Godot 4.3 prebuilt `android_debug.apk` template probably targets API 34. The validator likely flags this internally but doesn't push a user-facing message.

**Pragmatic decision:** rather than burn more time debugging Godot internals or switching to an alternate CI action (e.g., `firebelley/godot-export`), defer Android CI until Phase 7 alongside iOS. Local Godot 4.3 editor correctly imports the project, autoloads compile, theme loads — so the project is structurally sound; only the CI export pipeline is blocked.

## Phase 1 scope (revised twice)

TEC-08 for Phase 1 now reads:

> **"App buildea para Android e iOS MANUALMENTE en máquina del desarrollador. CI mobile builds difieren a Phase 7."**

The Android CI workflow file remains in `.github/workflows/build-android-debug.yml` (trigger: `workflow_dispatch` only) so it can be manually invoked for debugging during Phase 2-6 and re-enabled with proper fixes in Phase 7.

## Phase 7 will deliver

### Android CI
- Re-enable `on: push` triggers
- Either: install matching Android build-tools that match Godot 4.x's prebuilt template target SDK, OR switch to `gradle_build/use_gradle_build=true` with Godot's gradle template installed in `android/build/`
- Possibly switch CI action to `firebelley/godot-export@v6` (battle-tested)
- Sign release builds with production keystore stored as base64 GitHub Secret

### iOS CI
- `.github/workflows/build-ios-release.yml` using `macos-14` runner
- Fastlane match for provisioning + signing
- App Store Connect API key for upload
- TestFlight automated builds on tag push to main

## Manual build instructions (Phase 1)

### Android (debug, local)
```powershell
# Requires: Android SDK + JDK 17 + Godot 4.3 export templates installed locally
& "C:\Tools\Godot\4.3\Godot_v4.3-stable_win64.exe" --headless --export-debug "Android Debug" "build\android\BarraBrava-debug.apk"
```

### iOS (debug, local)
On macOS with Godot 4.3 + Xcode installed:
```sh
godot --headless --export-debug "iOS Debug" build/ios/BarraBrava-debug.ipa
# Or via editor: Project → Export → iOS → Export Project (debug)
# Then open the generated .xcodeproj in Xcode and Run on a connected device
```

The export preset `iOS Debug` is intentionally NOT added to `export_presets.cfg` in Phase 1.

## Reversal trigger

If during Phase 2-6 the dev finds themselves doing more than ~3 manual mobile builds per week, revisit this decision (e.g., resolve the Android CI issue early, OR add manual `workflow_dispatch` runs on demand).
