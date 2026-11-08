import type { ConfigContext, ExpoConfig } from 'expo/config';

// Adds build-time settings on top of app.json.
//   APP_VERSION_CODE  Build number: the Android versionCode and the last part of the version name.
//                     Each CI build gets a higher one, so the in-app updater can tell which APK is
//                     newer and Android installs it over the old one.
//   UPDATE_REPO       Public "owner/repo" whose GitHub releases hold the APKs. Without it the
//                     app never checks for updates.
//   CARTO_KEY         CARTO Basemaps key for the radar's street map. Without it the app uses
//                     CARTO's open tiles.
//   SUPABASE_URL      Supabase project URL and public (anon) key for accounts and sync.
//   SUPABASE_ANON_KEY Without them the app hides sign-in and works as before.
//   GOOGLE_SIGN_IN    "1" once Google is turned on in the Supabase project: shows Continue with Google.
export default ({ config }: ConfigContext): ExpoConfig => {
  const versionCode = Number(process.env.APP_VERSION_CODE) || 1;
  return {
    ...config,
    name: config.name ?? 'News Hammer',
    slug: config.slug ?? 'headlines',
    // "1.0" in app.json plus the build number, e.g. 1.0.7. Shown in Settings and the update pop-up.
    version: `${config.version ?? '1.0'}.${versionCode}`,
    android: {
      ...config.android,
      versionCode,
      permissions: [
        ...(config.android?.permissions ?? []),
        // Lets the app hand a downloaded update to Android's installer.
        'android.permission.REQUEST_INSTALL_PACKAGES',
        'android.permission.POST_NOTIFICATIONS',
        // Lets Settings offer "run in the background" so Samsung doesn't put the news checks to sleep.
        'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
      ],
    },
    extra: {
      ...config.extra,
      updateRepo: process.env.UPDATE_REPO ?? '',
      cartoKey: process.env.CARTO_KEY ?? '',
      supabaseUrl: process.env.SUPABASE_URL ?? '',
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? '',
      googleSignIn: process.env.GOOGLE_SIGN_IN === '1',
    },
  };
};
