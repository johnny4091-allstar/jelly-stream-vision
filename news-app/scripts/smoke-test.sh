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

# Weather: allow location, put the emulator in New York, then open the forecast and the radar the way
# a user taps them. A crash or "not responding" here fails the build so it never reaches phones.
ui_texts() {
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1
  adb shell cat /sdcard/ui.xml > ui.xml 2>/dev/null
  grep -oE '(text|content-desc)="[^"]+"' ui.xml | sed -E 's/^(text|content-desc)=//' | tr '\n' ' ' | cut -c1-1500
  echo
}

# Taps the first element whose text or content-desc matches the regex. Returns 1 if none.
tap() {
  local node bounds
  node="$(grep -oE '<node [^>]*>' ui.xml | grep -E "(text|content-desc)=\"$1" | head -n 1)"
  bounds="$(echo "$node" | grep -oE 'bounds="\[[0-9]+,[0-9]+\]\[[0-9]+,[0-9]+\]"' | grep -oE '[0-9]+' | tr '\n' ' ')"
  [ -n "$bounds" ] || return 1
  set -- $bounds
  adb shell input tap $(( ($1 + $3) / 2 )) $(( ($2 + $4) / 2 ))
}

check_alive() {
  local label="$1"
  adb logcat -d > "logcat-$label.txt"
  adb exec-out screencap -p > "screenshot-$label.png" || true
  echo "==== $label: on screen ===="
  ui_texts
  echo "==== $label: crash / React Native log ===="
  grep -E "FATAL EXCEPTION|AndroidRuntime|Fatal signal|ANR in|ReactNativeJS|unknown:React|libc +:|DEBUG +:" "logcat-$label.txt" | tail -n 120 || true
  echo "==== end ===="
  if grep -q "FATAL EXCEPTION\|Fatal signal\|ANR in $PKG" "logcat-$label.txt" || [ -z "$(adb shell pidof "$PKG" | tr -d '\r')" ]; then
    echo "$label: crashed or stopped responding"
    return 1
  fi
  echo "$label: running"
}

weather_flow() {
  adb shell pm grant "$PKG" android.permission.ACCESS_COARSE_LOCATION
  adb shell pm grant "$PKG" android.permission.ACCESS_FINE_LOCATION
  adb shell cmd location set-location-enabled true 2>/dev/null || true
  adb emu geo fix -74.006 40.713 >/dev/null 2>&1 || true
  adb logcat -c
  adb shell am force-stop "$PKG"
  adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null
  sleep 40
  adb emu geo fix -74.006 40.713 >/dev/null 2>&1 || true
  check_alive weather-card || return 1
  if ! tap "Weather"; then
    echo "::warning::No weather card on For you (location or forecast didn't load); skipped the weather screens."
    return 0
  fi
  sleep 15
  check_alive weather-screen || return 1
  if tap "Open weather radar"; then
    sleep 20
    check_alive radar-screen || return 1
  else
    echo "::warning::No radar on the Weather screen."
  fi
}
weather_flow || { echo "::error::The app crashed or froze opening the weather (see the log above)."; exit 1; }

# Information only: the background news check should be scheduled with Android's JobScheduler.
jobs="$(adb shell dumpsys jobscheduler | grep -c "$PKG/androidx.work" || true)"
echo "Background check jobs scheduled for $PKG: $jobs"
[ "$jobs" -gt 0 ] || echo "::warning::The background news check isn't scheduled; notifications won't arrive."
