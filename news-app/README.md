# Headlines

A personal news app built with React Native and Expo (TypeScript). It pulls headlines from public RSS feeds (CNN, BBC, NPR, AP, Fox News, The Verge, ESPN) and shows them in one feed, newest first. Cards show only what the feed provides: headline, image, source, time and a short summary. Tapping a card opens the publisher's page in an in-app browser.

- Tabs: **Today** (top 5 stories), **Feed** (topic filters: Top, World, Sports, Tech, Entertainment), **Saved**, **Settings**
- Turn sources on and off, and pick System, Light or Dark appearance, in Settings
- Saved stories and settings are stored on the phone with AsyncStorage
- Each feed is cached for 10 minutes. A feed that fails is skipped (its last cached copy is used if one exists)
- Pull to refresh. The app also refreshes when it opens or comes back to the foreground

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

**GitHub Actions (no setup):** every push that changes `news-app/` runs the *Headlines news app APK* workflow. Open the run under the repo's **Actions** tab and download `headlines-apk` from **Artifacts**. Unzip it, copy `headlines.apk` to your phone, and open it. You'll have to allow installs from unknown sources. You can also start the workflow by hand with **Run workflow**.

**EAS (Expo's cloud build):**
```sh
npx eas-cli@latest login
npx eas-cli@latest build -p android --profile preview
```
When it finishes, EAS gives you a link to download the APK.

**Locally** (needs Android Studio / the Android SDK and JDK 17):
```sh
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease
# APK: android/app/build/outputs/apk/release/app-release.apk
```

The release APK is signed with the debug key from the generated project. That's fine for installing on your own phone, but not for the Play Store.

## Notes

- **AP** has no public RSS feed of its own, so its headlines come from Google News' public RSS search, limited to apnews.com. These stories have no images, and tapping one opens it through a Google News link.
- **Fox News** has no entertainment feed, and **ESPN** only has sports. **The Verge** covers Tech and Entertainment. Those outlets don't show up under topics they don't publish.
- CNN serves its feeds over plain `http`, so the Android build allows cleartext traffic (`expo-build-properties` in `app.json`).

## Code map

| Path | What it does |
| --- | --- |
| `src/sources.ts` | Outlets and their feed URLs per topic |
| `src/services/parse.ts` | RSS 2.0 / Atom parsing, image and summary extraction |
| `src/services/news.ts` | Fetching, 10-minute cache, merging, Today picks |
| `src/state/` | Settings, saved stories, and the `useStories` hook |
| `src/screens/` | Today, Feed, Saved, Settings |
| `src/components/StoryCard.tsx` | The story card (hero, standard and compact layouts) |
