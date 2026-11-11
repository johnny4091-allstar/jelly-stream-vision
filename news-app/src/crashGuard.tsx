import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Component, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

// Keeps a crash from closing the app. Errors anywhere in the JavaScript (while drawing a screen, in
// a timer, in a promise) show a recovery screen instead, with the error, a way to send it, and
// ways to clear data. Imported first in index.ts so it's in place before anything else loads.

const BOOT_KEY = 'boot:pending:v1';
const REPORT_URL = 'https://news-hammer.netlify.app/api/crash';
/** Launches that didn't stay open this long count as crashes. */
const STABLE_MS = 15_000;
/** Temporary data that's safe to throw away: it's fetched again. Saved stories and settings stay. */
const CACHE_PREFIXES = ['feedcache:', 'previewimg:', 'weather:v1', 'livescore:'];

type Crash = { message: string; stack: string; where: string };
let current: Crash | null = null;
const listeners = new Set<(c: Crash | null) => void>();

function setCrash(c: Crash | null) {
  current = c;
  listeners.forEach((l) => l(c));
}

function describe(error: unknown, where: string): Crash {
  const e = error instanceof Error ? error : new Error(String(error));
  return { message: e.message || String(error), stack: (e.stack ?? '').split('\n').slice(0, 25).join('\n'), where };
}

// Replace React Native's handler, which closes the app on a fatal error in a release build.
type GlobalHandler = (error: unknown, isFatal?: boolean) => void;
const errorUtils = (globalThis as unknown as { ErrorUtils?: { getGlobalHandler: () => GlobalHandler; setGlobalHandler: (h: GlobalHandler) => void } })
  .ErrorUtils;
if (errorUtils && Platform.OS !== 'web') {
  const original = errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((error, isFatal) => {
    if (!isFatal) return original(error, isFatal);
    console.error('[crash]', error);
    setCrash(describe(error, 'app'));
  });
}

export async function clearCaches(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys().catch(() => [] as readonly string[]);
  await AsyncStorage.multiRemove(keys.filter((k) => CACHE_PREFIXES.some((p) => k.startsWith(p)))).catch(() => {});
}

/** Everything except saved stories (and the finished-setup flag), as a last resort. */
async function resetAll(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys().catch(() => [] as readonly string[]);
  await AsyncStorage.multiRemove(keys.filter((k) => k !== 'saved:v1' && k !== 'onboarding:v1')).catch(() => {});
}

function report(c: Crash): Promise<boolean> {
  return fetch(REPORT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      version: Constants.expoConfig?.version ?? '?',
      android: `${Platform.OS} ${Platform.Version}`,
      where: c.where,
      message: c.message.slice(0, 2000),
      stack: c.stack.slice(0, 6000),
    }),
  })
    .then((r) => r.ok)
    .catch(() => false);
}

function Recovery({ crash, onRetry }: { crash: Crash; onRetry: () => void }) {
  const [sent, setSent] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    await fn();
    setBusy(false);
    onRetry();
  };
  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.mark}>
          <Text style={styles.markText}>!</Text>
        </View>
        <Text style={styles.title}>News Hammer hit a problem</Text>
        <Text style={styles.sub}>The app stayed open so you can fix it. Try again first; if it keeps happening, send the report so it can be fixed, then clear the temporary data.</Text>
        <View style={styles.errorBox}>
          <Text selectable style={styles.errorText}>
            {crash.message}
          </Text>
        </View>
        <Pressable
          onPress={async () => {
            setSent('sending');
            setSent((await report(crash)) ? 'sent' : 'failed');
          }}
          disabled={sent === 'sending' || sent === 'sent'}
          style={[styles.btn, styles.primary]}
          accessibilityRole="button"
        >
          <Text style={styles.primaryText}>
            {sent === 'sent' ? '✓ Report sent' : sent === 'sending' ? 'Sending…' : sent === 'failed' ? 'Couldn’t send. Try again' : 'Send crash report'}
          </Text>
        </Pressable>
        <Pressable onPress={onRetry} disabled={busy} style={[styles.btn, styles.secondary]} accessibilityRole="button">
          <Text style={styles.secondaryText}>Try again</Text>
        </Pressable>
        <Pressable onPress={() => run(clearCaches)} disabled={busy} style={[styles.btn, styles.secondary]} accessibilityRole="button">
          <Text style={styles.secondaryText}>Clear temporary data and try again</Text>
        </Pressable>
        <Pressable onPress={() => run(resetAll)} disabled={busy} style={styles.link} accessibilityRole="button">
          <Text style={styles.linkText}>Reset settings (keeps saved stories)</Text>
        </Pressable>
        {busy ? <ActivityIndicator color="#FF5A1F" /> : null}
        <Text style={styles.fine}>The report holds only the error, the app version and the Android version.</Text>
      </ScrollView>
    </View>
  );
}

/** Catches errors while drawing any screen. */
class Boundary extends Component<{ children: ReactNode; onCrash: (c: Crash) => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error('[crash]', error);
    this.props.onCrash(describe(error, 'screen'));
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * Wraps the whole app. Counts launches that close within 15 seconds: after two in a row it clears
 * temporary data before starting; after four it shows the recovery screen instead of starting.
 */
export function CrashGuard({ children }: { children: ReactNode }) {
  const [crash, setCrashState] = useState<Crash | null>(current);
  const [ready, setReady] = useState(Platform.OS === 'web');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    listeners.add(setCrashState);
    return () => void listeners.delete(setCrashState);
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      const pending = Number(await AsyncStorage.getItem(BOOT_KEY).catch(() => null)) || 0;
      await AsyncStorage.setItem(BOOT_KEY, String(pending + 1)).catch(() => {});
      if (pending >= 4) setCrash({ message: `The app closed ${pending} times in a row while starting.`, stack: '', where: 'startup' });
      else if (pending >= 2) await clearCaches();
      setReady(true);
      timer = setTimeout(() => AsyncStorage.setItem(BOOT_KEY, '0').catch(() => {}), STABLE_MS);
    })();
    return () => clearTimeout(timer);
  }, []);

  if (crash)
    return (
      <Recovery
        crash={crash}
        onRetry={() => {
          AsyncStorage.setItem(BOOT_KEY, '0').catch(() => {});
          setCrash(null);
          setAttempt((a) => a + 1);
        }}
      />
    );
  if (!ready) return <View style={styles.page} />;
  return (
    <Boundary key={attempt} onCrash={setCrash}>
      {children}
    </Boundary>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#0B0B0D' },
  body: { padding: 24, paddingTop: 80, gap: 14 },
  mark: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FF5A1F', alignItems: 'center', justifyContent: 'center' },
  markText: { color: '#120600', fontSize: 34, fontWeight: '900' },
  title: { color: '#F5F5F7', fontSize: 30, fontWeight: '900' },
  sub: { color: '#B4B4BC', fontSize: 15, lineHeight: 22 },
  errorBox: { backgroundColor: '#151518', borderColor: '#2A2A31', borderWidth: 1, borderRadius: 14, padding: 14 },
  errorText: { color: '#F5F5F7', fontSize: 13, fontFamily: Platform.select({ android: 'monospace', default: undefined }) },
  btn: { height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: '#FF5A1F' },
  primaryText: { color: '#120600', fontSize: 16, fontWeight: '800' },
  secondary: { backgroundColor: '#1E1E23', borderColor: '#2A2A31', borderWidth: 1 },
  secondaryText: { color: '#F5F5F7', fontSize: 15, fontWeight: '800' },
  link: { alignItems: 'center', paddingVertical: 10 },
  linkText: { color: '#B4B4BC', fontSize: 14, fontWeight: '700' },
  fine: { color: '#8A8A93', fontSize: 12, textAlign: 'center' },
});
