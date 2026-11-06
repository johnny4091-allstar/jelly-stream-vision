import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  checkForUpdate,
  currentVersionName,
  downloadAndInstall,
  updatesEnabled,
  type AppUpdate,
} from '../services/appUpdate';
import { loadJSON, saveJSON } from '../state/storage';
import { type, useTheme } from '../theme';

const CHECK_INTERVAL_MS = 30 * 60 * 1000;
// After "Later", don't ask about the same build again for this long.
const SNOOZE_MS = 12 * 60 * 60 * 1000;
const SNOOZE_KEY = 'update:snooze:v1';

interface Snooze {
  versionCode: number;
  until: number;
}

/**
 * Checks for a newer APK when the app opens and when it returns to the foreground (at most every
 * 30 minutes), and asks "Update now / Later". Renders nothing unless there's an update.
 */
export function UpdatePrompt() {
  const c = useTheme();
  const [update, setUpdate] = useState<AppUpdate | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastCheck = useRef(0);

  const check = useCallback(async () => {
    if (Date.now() - lastCheck.current < CHECK_INTERVAL_MS) return;
    lastCheck.current = Date.now();
    try {
      const found = await checkForUpdate();
      if (!found) return;
      const snooze = await loadJSON<Snooze | null>(SNOOZE_KEY, null);
      if (snooze && snooze.versionCode === found.versionCode && Date.now() < snooze.until) return;
      setUpdate(found);
    } catch {
      // Offline or GitHub unreachable; try again next time.
    }
  }, []);

  useEffect(() => {
    if (!updatesEnabled()) return;
    check();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') check();
    });
    return () => sub.remove();
  }, [check]);

  if (!update) return null;

  const downloading = progress !== null;

  const later = () => {
    saveJSON(SNOOZE_KEY, { versionCode: update.versionCode, until: Date.now() + SNOOZE_MS } satisfies Snooze);
    setUpdate(null);
    setError(null);
  };

  const updateNow = async () => {
    setError(null);
    setProgress(0);
    try {
      await downloadAndInstall(update, setProgress);
      setUpdate(null);
    } catch {
      setError("The download didn't finish. Check your connection and try again.");
    } finally {
      setProgress(null);
    }
  };

  const sizeMb = update.sizeBytes > 0 ? `  \u00B7  ${(update.sizeBytes / 1_048_576).toFixed(0)} MB` : '';

  return (
    <Modal transparent animationType="fade" visible onRequestClose={downloading ? undefined : later}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: c.card }]}>
          <Text style={[type.title, { color: c.text }]}>Update available</Text>
          <Text style={[type.meta, { color: c.accent }]}>
            Version {update.versionName}
            {sizeMb}
          </Text>
          {currentVersionName() ? (
            <Text style={[type.caption, { color: c.tertiary }]}>You have version {currentVersionName()}</Text>
          ) : null}

          {update.whatsNew.length > 0 ? (
            <View style={[styles.whatsNew, { backgroundColor: c.background }]}>
              <Text style={[styles.whatsNewTitle, { color: c.text }]}>What's new</Text>
              <ScrollView style={styles.notes} contentContainerStyle={{ gap: 6 }}>
                {update.whatsNew.map((line, i) => (
                  <View key={i} style={styles.noteRow}>
                    <Text style={[type.body, { color: c.accent }]}>{'\u2022'}</Text>
                    <Text style={[type.body, { color: c.secondary, flex: 1 }]}>{line}</Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : null}
          {error ? <Text style={[type.caption, { color: c.accent }]}>{error}</Text> : null}

          {downloading ? (
            <View style={styles.progressWrap}>
              <View style={[styles.track, { backgroundColor: c.chip }]}>
                <View style={[styles.bar, { backgroundColor: c.accent, width: `${Math.round(progress * 100)}%` }]} />
              </View>
              <View style={styles.progressRow}>
                <ActivityIndicator size="small" color={c.tertiary} />
                <Text style={[type.caption, { color: c.secondary }]}>Downloading… {Math.round(progress * 100)}%</Text>
              </View>
            </View>
          ) : (
            <View style={styles.buttons}>
              <Pressable onPress={later} style={[styles.button, { backgroundColor: c.chip }]} accessibilityRole="button">
                <Text style={[styles.buttonText, { color: c.text }]}>Later</Text>
              </Pressable>
              <Pressable onPress={updateNow} style={[styles.button, { backgroundColor: c.accent }]} accessibilityRole="button">
                <Text style={[styles.buttonText, { color: c.onAccent }]}>Update now</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 28 },
  sheet: { borderRadius: 20, padding: 22, gap: 10 },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 8 },
  button: { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  buttonText: { fontSize: 16, fontWeight: '700' },
  progressWrap: { gap: 8, marginTop: 8 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  bar: { height: 6, borderRadius: 3 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  whatsNew: { borderRadius: 14, padding: 14, gap: 8, marginTop: 4 },
  whatsNewTitle: { fontSize: 15, fontWeight: '700' },
  notes: { maxHeight: 220 },
  noteRow: { flexDirection: 'row', gap: 8 },
});
