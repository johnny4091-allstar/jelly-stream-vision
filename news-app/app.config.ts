import type { ConfigContext, ExpoConfig } from 'expo/config';

// Adds build-time settings on top of app.json.
//   APP_VERSION_CODE  Android versionCode. Each CI build gets a higher one, so the in-app updater
//                     can tell which APK is newer and Android installs it over the old one.
//   UPDATE_REPO       Public "owner/repo" whose GitHub releases hold the APKs. Without it the
//                     app never checks for updates.
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'Headlines',
  slug: config.slug ?? 'headlines',
  android: {
    ...config.android,
    versionCode: Number(process.env.APP_VERSION_CODE) || 1,
    // Lets the app hand a downloaded update to Android's installer.
    permissions: [...(config.android?.permissions ?? []), 'android.permission.REQUEST_INSTALL_PACKAGES'],
  },
  extra: { ...config.extra, updateRepo: process.env.UPDATE_REPO ?? '' },
});
