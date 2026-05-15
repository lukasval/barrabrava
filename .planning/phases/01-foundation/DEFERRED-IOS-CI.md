# Deferred: iOS CI Builds → Phase 7

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

Only the **Android APK debug build** workflow (`.github/workflows/build-android-debug.yml`) is delivered in Phase 1.

iOS builds in Phase 1 are produced **manually on the developer's Mac** using the Godot editor + Xcode toolchain, NOT via GitHub Actions.

## Why deferred (solo dev pragmatics)

1. **GitHub Actions macOS runners cost ~10x more than Linux runners** (~$0.08/min vs $0.008/min). For a solo dev with a $40/mo budget, running macOS jobs on every push to develop is wasteful.
2. **No release/signing pipeline needed in Phase 1.** Phase 1 produces debug builds for the dev's own device, not store submission. Local Xcode export is sufficient.
3. **Provisioning profiles, certificates, and Fastlane match setup** all need to happen anyway as part of Phase 7 store submission. Doing them now and again at Phase 7 is duplicate work.
4. **Fastlane was already deferred to Phase 7 in CONTEXT.md** (Claude's Discretion section). iOS CI naturally pairs with Fastlane setup — they belong together.

## Phase 1 scope (revised)

TEC-08 for Phase 1 now reads: **"App buildea para Android desde GitHub Actions. Builds iOS son manuales en Mac del desarrollador hasta Phase 7."**

## Phase 7 will deliver

- `.github/workflows/build-ios-release.yml` using `macos-14` runner
- Fastlane match for provisioning + signing
- App Store Connect API key for upload
- TestFlight automated builds on tag push to main

## Manual iOS build instructions (Phase 1)

On macOS with Godot 4.3 + Xcode installed:

```sh
godot --headless --export-debug "iOS Debug" build/ios/BarraBrava-debug.ipa
# Or via editor: Project → Export → iOS → Export Project (debug)
# Then open the generated .xcodeproj in Xcode and Run on a connected device
```

The export preset `iOS Debug` is intentionally NOT added to `export_presets.cfg` in Phase 1 — it would force Godot CI to attempt iOS exports and fail.

## Reversal trigger

If during Phase 1 the dev finds themselves doing more than ~5 manual iOS builds per week, revisit this decision (e.g., add macOS runner only on tag push, not every push).
