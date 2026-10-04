/**
 * Currently published Android TV release. Update after each signed CI build:
 * copy the APK to public/download/aurora-tv-release.apk and paste its sha256 here.
 * While sha256 is empty, no update is offered and the install page keeps the legacy APK.
 */
export const TV_RELEASE = {
  versionCode: 2,
  versionName: "2.0.0",
  path: "/download/aurora-tv-release.apk",
  sha256: "",
} as const;

export const TV_SITE = "https://jelly-stream-vision.lovable.app";

export function tvReleaseReady() {
  return /^[a-f0-9]{64}$/.test(TV_RELEASE.sha256);
}
