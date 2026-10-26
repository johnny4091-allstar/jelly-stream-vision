# News Hammer

A personal news app built with React Native and Expo (TypeScript). It pulls headlines from public RSS feeds (CNN, BBC, NPR, AP, Reuters, Fox News, The New York Times, The Guardian, ABC News, CBS News, NBC News, Al Jazeera, Sky News, The Verge, TechCrunch, Ars Technica, Variety, ESPN, CBS Sports) and shows them in one feed, newest first. Cards show only what the feed provides: headline, image, source, time and a short summary. Tapping a card opens the publisher's page in a reader inside the app.

- Laid out like Samsung News, with a floating tab bar: **For you** (briefing card with a swipeable top-stories carousel, Top stories, For you), **News** (pinned topic chips and a section per topic you can Follow), **Live TV** (free 24/7 news channels), **Sports**, and **Following** (saved stories and followed topics). Settings is behind the ⋮ in the header
- Turn sources on and off, and pick System, Light or Dark appearance, in Settings
- Saved stories and settings are stored on the phone with AsyncStorage
- Each feed is cached for 10 minutes. A feed that fails is skipped (its last cached copy is used if one exists)
- Pull to refresh. The app also refreshes when it opens or comes back to the foreground
- Notifications for new top stories and new app versions, checked in the background about every 15 minutes (Android may wait longer to save battery). Tapping a story notification opens it. Settings → Notifications has switches for each, a test notification, "Check for news now", and a guide to let the app run in the background (needed on many Samsung phones). The guide also opens once, right after notifications are first allowed

## Test on your phone with Expo Go

1. Install **Expo Go** from the Play Store or App Store. It has to support **SDK 58**; the store version does.
2. Install Node.js 20 or newer on your computer.
3. Get the code and start the dev server:
   ```sh
   git clone https://github.com/johnny4091-allstar/jelly-stream-vision.git
   cd jelly-stream-vision
   git checkout ccr-a5a23463-7ie1bl   # or main, once this is merged
   cd news-app
   npm install
   npx expo start
   ```
4. A QR code appears in the terminal.
   - **Android:** open Expo Go and tap *Scan QR code*.
   - **iPhone:** scan it with the Camera app.
5. Your phone and computer need to be on the same Wi-Fi. If the phone can't connect (guest Wi-Fi, VPN, firewall), run `npx expo start --tunnel` instead.

Edits to the code reload on the phone automatically.

## Build the APK

**GitHub Actions (no setup):** every push that changes `news-app/` runs the *News Hammer APK* workflow. It builds the APK, then installs and opens it on an Android emulator; if the app crashes or quits, the build fails and is never offered as an update. Open the run under the repo's **Actions** tab and download `news-hammer-apk` from **Artifacts**. Unzip it, copy `news-hammer.apk` to your phone, and open it. You'll have to allow installs from unknown sources. You can also start the workflow by hand with **Run workflow**.

**Locally** (needs Android Studio / the Android SDK and JDK 17):
```sh
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease
# APK: android/app/build/outputs/apk/release/app-release.apk
```

The release APK is signed with the debug key from the generated project. That's fine for installing on your own phone, but not for the Play Store.

## Automatic updates

When the app opens, and when you come back to it (at most every 30 minutes), it checks for a newer APK. If there is one, it asks **Update now** or **Later**:

- **Update now** downloads the APK in the app, showing progress, and opens Android's install screen. The first time, Android asks you to allow installs from News Hammer. Your saved stories and settings are kept.
- **Later** asks again in 12 hours, or sooner if an even newer build comes out.

The pop-up shows the new version number (for example `1.0.7`) and a **What's new** list. That list comes from `WHATSNEW.md`: one `- ` line per change. Update it in the same commit as the change. The version is `"version"` from `app.json` (`1.0`) plus the build number. If the app is in the background when a new version comes out, you also get a notification.

No Expo services are involved. Every GitHub Actions build gets a higher version number and is published as a release in a **public** GitHub repo, and the app checks that repo. A public repo is needed because this one is private, and a phone can't read a private repo without a password built into the app. The public repo only holds the APK files, not your code.

### One-time setup

1. Create a new **public** repository, for example `johnny4091-allstar/headlines-releases`. It can stay empty; the first build adds a README so releases can be published.
2. Create a token that can publish releases there: GitHub → Settings → Developer settings → **Fine-grained personal access tokens** → Generate new token. Under *Repository access*, choose only the releases repo, and set *Contents* to **Read and write**.
3. In **this** repo, go to Settings → Secrets and variables → Actions:
   - On the **Variables** tab, add `UPDATE_REPO` = `johnny4091-allstar/headlines-releases`.
   - On the **Secrets** tab, add `RELEASES_TOKEN` = the token.
4. Run the workflow (Actions → *News Hammer APK* → **Run workflow**) and install that APK once by hand. APKs built before this setup don't know where to look for updates.

After that, every push that changes `news-app/` builds a new APK, publishes it, and installed apps offer it.

Each release is tagged `build-<number>` (the workflow run number, which is also the APK's Android version code). The app always offers the release marked **Latest**.

## Notes

- **Weather** on For you uses the phone's location (asked the first time you tap *Show weather*, only while the app is open) and a free forecast from [Open-Meteo](https://open-meteo.com), which needs no API key. Coordinates are rounded to about 1 km before they're sent; the place name comes from the phone's own geocoder. Settings → Weather switches °F/°C or turns it off. The rain radar uses [RainViewer](https://www.rainviewer.com/api.html)'s free tiles (no key; zoom 7 at most, scaled up beyond that) over CARTO's OpenStreetMap basemap: a still built from tiles on the card, and a Leaflet map in a WebView that loops the last two hours on the Radar screen. With a `CARTO_KEY` repository secret (a free CARTO Basemaps key) the street map uses CARTO's keyed tiles; without it, their open tiles. `node scripts/check-weather.mjs` and `scripts/check-radar.mjs` (run in CI) check both services.
- **Live TV** plays each broadcaster's own free 24/7 live stream on YouTube (ABC News Live, NBC News NOW, CBS News 24/7, Sky News, Al Jazeera English, DW News, France 24, euronews, Bloomberg TV, NASA). The app looks up the video that's live on the channel's `/live` page and plays it with YouTube's player, so YouTube's ads and rules apply. Streams whose owner blocks playback in other apps show a thumbnail; tapping it opens YouTube's mobile site inside the app. Channels are in `src/live.ts`; the CI log's *Check Live TV channels* step shows which are live and embeddable.

- **AP** has no public RSS feed of its own, so its headlines come from Google News' public RSS search, limited to apnews.com. These stories have no images, and tapping one opens it through a Google News link.
- Not every outlet covers every topic. **Fox News** has no entertainment feed; **The New York Times**, **CBS News**, **NBC News** and **Sky News** have no sports feed in the app; **Al Jazeera** covers News and World. **The Verge** covers Tech and Entertainment. **ESPN** and **CBS Sports** only cover sports, **TechCrunch** and **Ars Technica** only tech, and **Variety** only entertainment. Outlets don't show up under topics they don't publish.
- **Reuters**, like AP, has no public RSS, so its stories come through Google News' RSS search limited to reuters.com.
- `node scripts/check-feeds.mjs` (run in CI) fetches and parses every feed and prints which ones work.
- CNN serves its feeds over plain `http`, so the Android build allows cleartext traffic (`expo-build-properties` in `app.json`).

## Code map

| Path | What it does |
| --- | --- |
| `src/sources.ts` | Outlets and their feed URLs per topic |
| `src/services/parse.ts` | RSS 2.0 / Atom parsing, image and summary extraction |
| `src/services/news.ts` | Fetching, 10-minute cache, merging, Today picks |
| `src/state/` | Settings, saved stories, and the `useStories` hook |
| `src/services/appUpdate.ts`, `src/components/UpdatePrompt.tsx` | In-app updates: check, download, install |
| `src/services/notifications.ts` | Background check and local notifications |
| `src/screens/ArticleScreen.tsx` | The in-app reader |
| `src/live.ts`, `src/screens/LiveTvScreen.tsx` | Live TV channels and player |
| `WHATSNEW.md` | "What's new" text for the next update |
| `app.config.ts` | Build-time version number and update repo |
| `scripts/smoke-test.sh` | CI check that the APK opens on an emulator without crashing |
| `src/screens/` | For you, News, Sports, Following, topic list, Settings, reader |
| `src/components/StoryCard.tsx` | Story cards: Samsung-style row, lead row and full-image card |
| `src/components/BriefingCard.tsx`, `FloatingTabBar.tsx`, `TopicChips.tsx` | Briefing carousel, floating tab bar, topic pills |
