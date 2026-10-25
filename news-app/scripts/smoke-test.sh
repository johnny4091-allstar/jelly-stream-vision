#!/usr/bin/env bash
# Opens the app on the running emulator and fails if it crashes or quits.
#
# If a release is already published (UPDATE_REPO), that version is installed and opened first and
# the new APK is installed over it, the same way the in-app updater does it on a phone. The
# relevant part of logcat is printed so a crash can be diagnosed from the CI log.
set -u
APK="${1:-news-hammer.apk}"
PKG=com.personal.headlines

launch_and_check() {
  local label="$1"
  adb shell pm grant "$PKG" android.permission.POST_NOTIFICATIONS 2>/dev/null || true
  adb logcat -c
  adb shell am force-stop "$PKG"
  adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null
  # Give it time to start, render and fetch feeds, then check it's still alive.
  sleep 45
  adb logcat -d > "logcat-$label.txt"
  adb exec-out screencap -p > "screenshot-$label.png" || true
  echo "==== $label: crash / React Native log ===="
  grep -E "FATAL EXCEPTION|AndroidRuntime|Fatal signal|ReactNativeJS|ReactNative|unknown:React|Hermes|SoLoader|libc +:|DEBUG +:" "logcat-$label.txt" | tail -n 200 || true
  echo "==== end ===="
  if grep -q "FATAL EXCEPTION\|Fatal signal" "logcat-$label.txt"; then
    echo "$label: crashed"
    return 1
  fi
  if [ -z "$(adb shell pidof "$PKG" | tr -d '\r')" ]; then
    echo "$label: not running 45 seconds after launch"
    return 1
  fi
  echo "$label: running"
}

# Releases up to 1.0.10 named the file headlines.apk.
download_previous() {
  for name in news-hammer.apk headlines.apk; do
    curl -fsSL -o previous.apk "https://github.com/$UPDATE_REPO/releases/latest/download/$name" && return 0
  done
  return 1
}

if [ -n "${UPDATE_REPO:-}" ] && download_previous; then
  echo "Installing the currently published version first"
  adb install -r previous.apk && launch_and_check previous || echo "(the published version has problems; see above)"
  echo "Updating to the new build"
  adb install -r "$APK" || { echo "::error::The new APK doesn't install over the published one."; exit 1; }
  launch_and_check updated || { echo "::error::The app doesn't open after updating (see the log above)."; exit 1; }
fi

echo "Fresh install"
adb uninstall "$PKG" >/dev/null 2>&1 || true
adb install "$APK" || exit 1
launch_and_check fresh || { echo "::error::The app doesn't open on a fresh install (see the log above)."; exit 1; }
