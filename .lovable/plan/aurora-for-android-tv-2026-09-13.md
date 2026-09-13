# Aurora for Android TV

Build a separate Android TV version of Aurora and give you a downloadable install file.

## What you get

- A TV app that shows up in the Android TV / Google TV launcher with its own Aurora banner artwork.
- It loads the live Aurora site inside the TV app, same as the phone app.
- A TV install file (`aurora-tv.apk`) you can sideload, plus a page to download it.
- The phone app stays exactly as it is; the TV one is a second, separate app.

## Remote-control support

Right now Aurora is built for touch and mouse. On a TV you only have a D-pad remote, so these changes are needed for it to be usable:

- Every poster, row, button and menu becomes focusable and highlights clearly when selected.
- Left/right moves along a row, up/down between rows, OK opens a title.
- In the player: OK plays/pauses, left/right skips 10 seconds, back exits.
- Bigger text and spacing so it reads from across the room.

## Technical notes

- Add a second Capacitor Android project configured for TV: `LEANBACK_LAUNCHER` intent filter, `android.software.leanback` feature, `touchscreen` not required, TV banner drawable, distinct app id (`app.lovable.aurora.tv`).
- Build the debug APK with the installed JDK 21 + Android SDK, copy to `public/download/aurora-tv.apk`.
- Add `/get-tv-app` route mirroring `/get-app` with sideload instructions (Downloader app / USB).
- Focus work in the web app: CSS `:focus-visible` ring tokens, `tabIndex` on cards/rows, a key handler in `watch.$id.tsx` for D-pad keycodes, and `scroll-margin` so focused cards scroll into view.

## Limitation

The APK is unsigned/debug, so you install it manually (Downloader app or USB). Play Store publishing is a separate process.
