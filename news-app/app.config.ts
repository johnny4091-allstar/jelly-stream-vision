import type { ConfigContext, ExpoConfig } from 'expo/config';

// Adds build-time settings on top of app.json.
//   EAS_PROJECT_ID    turns on over-the-air updates (the app then asks "Update now / Later").
//                     Without it the app builds and runs normally, just without updates.
//   APP_VERSION_CODE  Android versionCode, so a newer APK installs over an older one.
export default ({ config }: ConfigContext): ExpoConfig => {
  const projectId = process.env.EAS_PROJECT_ID;
  const versionCode = Number(process.env.APP_VERSION_CODE) || 1;

  return {
    ...config,
    name: config.name ?? 'Headlines',
    slug: config.slug ?? 'headlines',
    android: { ...config.android, versionCode },
    ...(projectId
      ? {
          // An update only reaches APKs with the same "version" in app.json. Bump it whenever a
          // native module is added, then install the new APK once.
          runtimeVersion: { policy: 'appVersion' },
          updates: {
            url: `https://u.expo.dev/${projectId}`,
            // The app checks itself so it can ask first (src/state/useUpdatePrompt.ts).
            checkAutomatically: 'NEVER',
            requestHeaders: { 'expo-channel-name': 'production' },
          },
          extra: { ...config.extra, eas: { projectId } },
        }
      : {}),
  };
};
