#!/usr/bin/env bash
# Installs the APK on the running emulator, opens the app and fails if it crashes or quits.
# The relevant part of logcat is printed so a crash can be diagnosed from the CI log.
set -u
APK="${1:-headlines.apk}"
PKG=com.personal.headlines

adb install -r "$APK" || exit 1
# Grant notifications up front so the permission dialog doesn't cover the app.
adb shell pm grant "$PKG" android.permission.POST_NOTIFICATIONS 2>/dev/null || true
adb logcat -c
adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null

# Give it time to start, render and fetch feeds, then check it's still alive.
sleep 45
adb logcat -d > logcat.txt
adb exec-out screencap -p > screenshot.png || true

PID="$(adb shell pidof "$PKG" | tr -d '\r')"
echo "---- crash / React Native log ----"
grep -E "FATAL EXCEPTION|AndroidRuntime|Fatal signal|ReactNativeJS|ReactNative|unknown:React|Hermes|SoLoader|libc +:" logcat.txt | tail -n 200 || true
echo "---- end ----"

if grep -q "FATAL EXCEPTION\|Fatal signal" logcat.txt; then
  echo "::error::The app crashed on launch (see the log above)."
  exit 1
fi
if [ -z "$PID" ]; then
  echo "::error::The app is not running 45 seconds after launch."
  exit 1
fi
echo "App is running (pid $PID)."
