/**
 * Currently published Android phone release. Update after each signed CI build:
 * copy the APK to public/download/aurora-mobile-release.apk and paste its sha256 here.
 * While sha256 is empty, no update is offered and /get-app keeps serving the legacy APK.
 */
export const PHONE_RELEASE = {
  versionCode: 1,
  versionName: "1.0.0",
  path: "/download/aurora-mobile-release.apk",
  sha256: "",
} as const;

/** Older phone APK (package app.lovable.aurora), served until the first new release is published. */
export const LEGACY_PHONE_APK = {
  versionName: "1.1.0",
  path: "/download/aurora.apk",
} as const;

export function phoneReleaseReady() {
  return /^[a-f0-9]{64}$/.test(PHONE_RELEASE.sha256);
}
