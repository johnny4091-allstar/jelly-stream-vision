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
  # The emulator's own apps sometimes freeze ("Pixel Launcher isn't responding") and Android's box
  # covers the screen. Wait it out so the test can see News Hammer again; our own ANRs still fail.
  if grep -q "responding" ui.xml && ! grep -q "News Hammer isn" ui.xml && grep -q 'text="Wait"' ui.xml; then
    echo "(dismissing another app's not-responding dialog)" >&2
    tap "Wait" >/dev/null
    sleep 3
    adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1
    adb shell cat /sdcard/ui.xml > ui.xml 2>/dev/null
  fi
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

# Scrolls the screen up by about half and reads it again.
scroll_down() {
  # Swipe from three-quarters to a quarter of the way down the real screen.
  local size w h
  size="$(adb shell wm size | grep -oE '[0-9]+x[0-9]+' | tail -n 1)"
  w="${size%x*}"
  h="${size#*x}"
  adb shell input swipe $((w / 2)) $((h * 3 / 4)) $((w / 2)) $((h / 4)) 500
  sleep 2
  ui_texts >/dev/null
}

# Taps the element, scrolling down up to three times to find it.
tap_scrolling() {
  for _ in 1 2 3 4; do
    tap "$1" && return 0
    scroll_down
  done
  return 1
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
  # The weather error guard keeps the app open, but a caught error is still a bug.
  if grep -q "\[weather\] UI error" "logcat-$label.txt"; then
    echo "$label: the weather UI threw an error (see above)"
    return 1
  fi
  echo "$label: running"
}

# A new install opens on the setup screens: go through them the way a user would.
onboarding_flow() {
  check_alive onboarding-welcome || return 1
  # Welcome slides: Skip goes to the last one.
  tap "Skip" && sleep 2 && ui_texts >/dev/null
  if ! { tap "Maybe later" || tap "Get started"; }; then
    echo "::warning::No setup screen on a fresh install."
    return 0
  fi
  sleep 3
  ui_texts >/dev/null
  tap "News" || true
  for _ in 1 2 3 4 5 6 7; do
    if tap "Start reading"; then
      sleep 4
      check_alive onboarding-done || return 1
      return 0
    fi
    tap "Continue" || break
    sleep 4
    ui_texts >/dev/null
  done
  echo "::warning::Couldn't finish the setup screens."
}
onboarding_flow || { echo "::error::The app crashed or froze in the setup screens (see the log above)."; exit 1; }

weather_flow() {
  adb shell cmd location set-location-enabled true 2>/dev/null || true
  # Keep feeding the emulator's GPS a position while the app looks for one.
  ( for _ in $(seq 1 60); do adb emu geo fix -74.006 40.713 >/dev/null 2>&1; sleep 3; done ) &
  local feeder=$!
  adb logcat -c
  adb shell am force-stop "$PKG"
  adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null
  sleep 30
  check_alive weather-ask || return 1
  # The one-time "run in the background" guide can open over the home screen; close it.
  if tap "Not now"; then
    sleep 2
    ui_texts >/dev/null
  fi
  # A newer published version shows the update pop-up over everything; dismiss it.
  if tap "Later"; then
    sleep 2
    ui_texts >/dev/null
  fi
  # The user's path: "Show weather", then Android's location pop-up.
  if tap "Show weather"; then
    sleep 4
    ui_texts >/dev/null
    tap "While using the app" || tap "Only this time" || tap "Allow" || echo "::warning::No location pop-up appeared."
    sleep 40
  else
    echo "::warning::No Show weather button on Today."
  fi
  check_alive weather-card || { kill $feeder 2>/dev/null; return 1; }
  # The temperature opens the forecast; the middle of the card is the radar.
  if ! { tap '[-0-9]+°"' || tap "Weather"; }; then
    kill $feeder 2>/dev/null
    echo "::warning::No weather card on Today (location or forecast didn't load); skipped the weather screens."
    return 0
  fi
  sleep 15
  check_alive weather-screen || { kill $feeder 2>/dev/null; return 1; }
  if tap "Open weather radar"; then
    sleep 20
    check_alive radar-screen || { kill $feeder 2>/dev/null; return 1; }
  else
    echo "::warning::No radar on the Weather screen."
  fi
  kill $feeder 2>/dev/null
  return 0
}
weather_flow || { echo "::error::The app crashed or froze opening the weather (see the log above)."; exit 1; }

# The home dashboard's Quick read (swipe stories, read aloud) and Scores screens.
dashboard_flow() {
  adb logcat -c
  adb shell am force-stop "$PKG"
  adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null
  sleep 30
  check_alive dashboard || return 1
  tap "Later" && sleep 2 && ui_texts >/dev/null
  if tap_scrolling "Quick read"; then
    sleep 8
    check_alive quick-read || return 1
    tap "Listen" && sleep 5 && { check_alive quick-read-listen || return 1; }
    adb shell input keyevent KEYCODE_BACK
    sleep 3
    ui_texts >/dev/null
  else
    echo "::warning::No Quick read tile on Today."
  fi
  if tap "Scores"; then
    sleep 8
    check_alive scores || return 1
  else
    echo "::warning::No Scores tile on Today."
  fi
}
dashboard_flow || { echo "::error::The app crashed or froze on the dashboard (see the log above)."; exit 1; }

# The other tabs, then a story with its Full coverage screen.
tabs_flow() {
  for t in Explore Watch You Today; do
    ui_texts >/dev/null
    # The closing quote makes it an exact match ("You" mustn't match "Your teams").
    if tap "$t\""; then
      sleep 8
      check_alive "tab-$t" || return 1
      if [ "$t" = Explore ]; then
        if tap "Pulse"; then
          sleep 8
          check_alive pulse || return 1
          adb shell input keyevent KEYCODE_BACK
          sleep 2
        else
          echo "::warning::No Pulse card on Explore."
        fi
      fi
    else
      echo "::warning::No $t tab."
    fi
  done
  if tap_scrolling "Your (briefing|day in news)"; then
    sleep 8
    check_alive briefing || return 1
    adb shell input keyevent KEYCODE_BACK
    sleep 2
    ui_texts >/dev/null
  else
    echo "::warning::No briefing tile on Today."
  fi
  # Back to the top of Today for the top story.
  tap 'Today"' && sleep 3 && ui_texts >/dev/null
  if tap "Top story"; then
    sleep 10
    check_alive story || return 1
    if tap "Full coverage"; then
      sleep 4
      check_alive coverage || return 1
      adb shell input keyevent KEYCODE_BACK
      sleep 2
    else
      echo "::warning::No Full coverage link on the top story (no other outlet had it)."
    fi
    adb shell input keyevent KEYCODE_BACK
    sleep 2
  else
    echo "::warning::No top story on Today."
  fi
}
tabs_flow || { echo "::error::The app crashed or froze on a tab or story (see the log above)."; exit 1; }

# Information only: the background news check should be scheduled with Android's JobScheduler.
jobs="$(adb shell dumpsys jobscheduler | grep -c "$PKG/androidx.work" || true)"
echo "Background check jobs scheduled for $PKG: $jobs"
[ "$jobs" -gt 0 ] || echo "::warning::The background news check isn't scheduled; notifications won't arrive."
