# Aurora Android phone app

Kotlin WebView shell for https://jelly-stream-vision.lovable.app, made for phones and tablets.
Package id `app.aurora.mobile` (permanent).

- Portrait or landscape; fullscreen video switches to landscape and hides the system bars.
- Keeps the screen awake on player pages; links to other sites open in the phone's browser.
- Links to the site open in the app; updates itself from `/api/public/phone-version`.
- Version: `appVersionCode` / `appVersionName` in `app/build.gradle.kts` (only place).
- CI: `.github/workflows/android-phone.yml` — debug APK on PRs and feature branches, signed release APK on `main`
  (signed with the Aurora TV keystore, `ANDROID_TV_*` secrets).
- Release: bump version, merge to main, download the `aurora-mobile-release` artifact, upload the APK to
  `public/download/aurora-mobile-release.apk`, then set `versionCode`, `versionName` and `sha256`
  (from the `.sha256` file) in `src/lib/phone-release.ts`. Installed apps then offer the update, and
  `/get-app` serves the new APK instead of the legacy `aurora.apk`.

iPhone/iPad: no native build. The site is a standalone web app; `/get-app` shows the Safari
"Add to Home Screen" steps.
