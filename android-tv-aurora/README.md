# Aurora Android TV app

Kotlin WebView shell for https://jelly-stream-vision.lovable.app. Package id `app.aurora.tv` (permanent).

- Version: `appVersionCode` / `appVersionName` in `app/build.gradle.kts` (only place).
- CI: `.github/workflows/aurora-tv.yml` (folder `android-tv-aurora/`) — debug APK on PRs, signed release APK on `main`.
- Release: bump version, merge to main, download the `aurora-tv-release` artifact, upload the APK to
  `public/download/aurora-tv-release.apk`, then set `versionCode`, `versionName` and `sha256`
  (from the `.sha256` file) in `src/lib/tv-release.ts`. Installed apps then offer the update.
