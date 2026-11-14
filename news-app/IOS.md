# News Hammer on iPhone and iPad

The same app builds for iPhone and iPad (it runs full screen on iPad). Expo's cloud build service
(EAS Build) makes the iOS app, so no Mac is needed, and `.github/workflows/news-app-ios.yml` uploads
each build to **TestFlight**, Apple's app for installing test versions. From TestFlight it can later
go to the App Store.

Until the keys below exist, the iOS workflow just prints a notice and stops.

## What you need

- An **Apple Developer Program** membership ($99 a year): https://developer.apple.com/programs/enroll/
  Apple can take a day or two to approve it.
- A free **Expo** account: https://expo.dev/signup

## One-time setup

### 1. Register the app ID (Apple Developer)

https://developer.apple.com/account/resources/identifiers/list → **+** → **App IDs** → **App** →
Description `News Hammer`, Bundle ID **Explicit** `com.johnny4091.newshammer` → Continue → Register.

While you're there, note your **Team ID** (Membership details page, 10 characters).

### 2. Create the app (App Store Connect)

https://appstoreconnect.apple.com/apps → **+** → **New App**:
- Platform **iOS**, Name `News Hammer` (if it's taken, try `News Hammer: Every Side`)
- Language English, Bundle ID `com.johnny4091.newshammer`, SKU `newshammer`
- User access: Full access

Open the new app → **App Information** → copy the **Apple ID** (a number like `6741234567`).

### 3. Create an App Store Connect API key

https://appstoreconnect.apple.com/access/integrations/api → **Team Keys** → **+** →
name `EAS`, access **Admin** → Generate. Then:
- **Download** the `.p8` file (Apple lets you download it only once).
- Copy the **Key ID** and the **Issuer ID** shown on that page.

### 4. Create the Expo project and token

- https://expo.dev → **Create a project**: display name `News Hammer`, slug **`headlines`** (it
  must match the app's slug). Open the project and copy its **Project ID**.
- https://expo.dev/settings/access-tokens → **Create token** → copy it.

### 5. Add them to GitHub

Repository **Settings → Secrets and variables → Actions**.

**Secrets** tab, **New repository secret**:

| Name | Value |
|---|---|
| `EXPO_TOKEN` | the Expo access token |
| `ASC_API_KEY_P8` | the whole text of the `.p8` file (open it in a text editor, copy everything) |

**Variables** tab, **New repository variable**:

| Name | Value |
|---|---|
| `EAS_PROJECT_ID` | the Expo Project ID |
| `ASC_APP_ID` | the Apple ID number from step 2 |
| `APPLE_TEAM_ID` | your Team ID from step 1 |
| `ASC_KEY_ID` | the API key's Key ID |
| `ASC_ISSUER_ID` | the Issuer ID |
| `APPLE_TEAM_TYPE` | only if you enrolled as a company: `COMPANY_OR_ORGANIZATION` |

### 6. Build

GitHub → **Actions** → **News Hammer iOS** → **Run workflow** (later builds run on every app change).
The build takes about 20–30 minutes on Expo's servers, then the upload goes to TestFlight, where
Apple takes another 10–30 minutes to process it.

### 7. Install on your iPhone and iPad

- App Store Connect → your app → **TestFlight** → **Internal Testing** → **+** → create a group, add
  yourself (your Apple ID email).
- Install **TestFlight** from the App Store on each device and accept the invite. New builds then
  appear there and update with a tap.

## What's different on iPhone and iPad

- Updates come through TestFlight (or the App Store), so the in-app "Update now" pop-up is Android
  only.
- Home screen widgets and the always-on lock-screen score are Android only for now (iOS widgets need
  separate native code).
- Background news checks run when iOS allows; iOS decides how often.
