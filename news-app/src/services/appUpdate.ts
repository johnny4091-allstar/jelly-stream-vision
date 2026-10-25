import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform } from 'react-native';

// Self-hosted updates: CI publishes each APK as a GitHub release (tag "build-<versionCode>") in a
// public repo. The app compares that number with its own versionCode, downloads the newer APK and
// hands it to Android's installer. Every APK is signed with the same key, so it installs in place.

export interface AppUpdate {
  versionCode: number;
  /** Human version, e.g. "1.0.7". */
  versionName: string;
  /** "What's new" lines from the release notes (WHATSNEW.md in the repo). */
  whatsNew: string[];
  apkUrl: string;
  sizeBytes: number;
}

const FLAG_GRANT_READ_URI_PERMISSION = 1;

/** "owner/repo" of the public releases repo, baked in at build time (UPDATE_REPO). */
function updateRepo(): string | undefined {
  const repo = (Constants.expoConfig?.extra as { updateRepo?: string } | undefined)?.updateRepo;
  return repo && /^[\w.-]+\/[\w.-]+$/.test(repo) ? repo : undefined;
}

export function updatesEnabled(): boolean {
  return Platform.OS === 'android' && !__DEV__ && !!updateRepo() && currentVersionCode() > 0;
}

export function currentVersionCode(): number {
  return Number(Application.nativeBuildVersion) || 0;
}

export function currentVersionName(): string {
  return Application.nativeApplicationVersion ?? '';
}

/** Release notes as a list: Markdown bullets become items, headings and blank lines are dropped. */
function parseNotes(body: string): string[] {
  return body
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.replace(/^[-*\u2022]\s+/, ''));
}

interface ReleaseJSON {
  tag_name?: string;
  name?: string | null;
  body?: string | null;
  assets?: { name: string; browser_download_url: string; size: number }[];
}

/** The latest published APK if it's newer than this one, otherwise null. */
export async function checkForUpdate(): Promise<AppUpdate | null> {
  const repo = updateRepo();
  if (!repo) return null;
  const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) return null;
  const release = (await res.json()) as ReleaseJSON;
  const versionCode = Number(/^build-(\d+)$/.exec(release.tag_name ?? '')?.[1]);
  const apk = release.assets?.find((a) => a.name.endsWith('.apk'));
  if (!versionCode || !apk || versionCode <= currentVersionCode()) return null;
  return {
    versionCode,
    versionName: /\d+\.\d+\.\d+/.exec(release.name ?? '')?.[0] ?? `build ${versionCode}`,
    whatsNew: parseNotes(release.body ?? ''),
    apkUrl: apk.browser_download_url,
    sizeBytes: apk.size,
  };
}

/** Downloads the APK (reporting 0–1 progress) and opens Android's install screen. */
export async function downloadAndInstall(update: AppUpdate, onProgress: (p: number) => void): Promise<void> {
  const dir = FileSystem.cacheDirectory;
  if (!dir) throw new Error('No cache directory');
  const fileUri = `${dir}headlines-${update.versionCode}.apk`;
  const download = FileSystem.createDownloadResumable(update.apkUrl, fileUri, {}, (p) => {
    const total = p.totalBytesExpectedToWrite > 0 ? p.totalBytesExpectedToWrite : update.sizeBytes;
    if (total > 0) onProgress(Math.min(1, p.totalBytesWritten / total));
  });
  const result = await download.downloadAsync();
  if (!result || result.status !== 200) throw new Error(`Download failed (${result?.status ?? 'no response'})`);
  const contentUri = await FileSystem.getContentUriAsync(result.uri);
  // Android asks once to allow installs from this app, then shows its normal update screen.
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: contentUri,
    type: 'application/vnd.android.package-archive',
    flags: FLAG_GRANT_READ_URI_PERMISSION,
  });
}
