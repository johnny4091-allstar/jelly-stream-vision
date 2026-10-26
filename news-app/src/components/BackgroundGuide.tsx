import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { AppState, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { requestBackgroundAccess } from '../services/notifications';
import { type, useTheme } from '../theme';

const SEEN_KEY = 'guide:background:v1';

// A tiny event hub so the app (after the permission pop-up) and Settings can both open the guide.
const listeners = new Set<() => void>();
export function showBackgroundGuide(): void {
  listeners.forEach((l) => l());
}

/** Opens the guide once, the first time notifications are allowed. */
export async function showBackgroundGuideOnce(): Promise<void> {
  try {
    if (await AsyncStorage.getItem(SEEN_KEY)) return;
    await AsyncStorage.setItem(SEEN_KEY, '1');
  } catch {
    return;
  }
  showBackgroundGuide();
}

const STEPS = [
  { title: 'Tap "Allow in background" below', detail: 'Android asks whether News Hammer can always run in the background.' },
  { title: 'Choose "Allow"', detail: 'This stops battery saving from pausing the news checks.' },
  {
    title: 'Samsung phones: set Battery to "Unrestricted"',
    detail: 'Tap "Open app settings", then Battery → Unrestricted.',
  },
];

/**
 * Walks the user through letting News Hammer run in the background, so notifications for new
 * stories and updates arrive on time. Shown right after notifications are allowed.
 */
export function BackgroundGuide() {
  const c = useTheme();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const open = () => {
      setStep(0);
      setVisible(true);
    };
    listeners.add(open);
    return () => {
      listeners.delete(open);
    };
  }, []);

  // Coming back from Android's prompt moves the guide on to the Samsung step.
  useEffect(() => {
    if (!visible) return;
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setStep((n) => (n === 1 ? 2 : n));
    });
    return () => sub.remove();
  }, [visible]);

  const allow = async () => {
    setStep(1);
    await requestBackgroundAccess();
  };

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={() => setVisible(false)}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: c.card }]}>
          <View style={[styles.iconWrap, { backgroundColor: c.accent }]}>
            <Ionicons name="notifications" size={28} color="#fff" />
          </View>
          <Text style={[type.title, { color: c.text, textAlign: 'center' }]}>Get alerts on time</Text>
          <Text style={[type.body, { color: c.secondary, textAlign: 'center' }]}>
            News Hammer checks for new stories and app updates in the background. Your phone may pause it to save
            battery unless you allow it.
          </Text>

          <View style={styles.steps}>
            {STEPS.map((s, i) => {
              const done = i < step;
              const current = i === step;
              return (
                <View key={s.title} style={styles.step}>
                  <View
                    style={[
                      styles.num,
                      { backgroundColor: done ? '#34C759' : current ? c.text : c.chip, borderColor: c.separator },
                    ]}
                  >
                    {done ? (
                      <Ionicons name="checkmark" size={15} color="#fff" />
                    ) : (
                      <Text style={{ color: current ? c.background : c.secondary, fontWeight: '800' }}>{i + 1}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[styles.stepTitle, { color: current ? c.text : c.secondary }]}>{s.title}</Text>
                    <Text style={[type.caption, { color: c.tertiary }]}>{s.detail}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          {step < 2 ? (
            <Pressable onPress={allow} style={[styles.primary, { backgroundColor: c.accent }]} accessibilityRole="button">
              <Text style={styles.primaryText}>Allow in background</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => Linking.openSettings().catch(() => {})}
              style={[styles.primary, { backgroundColor: c.accent }]}
              accessibilityRole="button"
            >
              <Text style={styles.primaryText}>Open app settings</Text>
            </Pressable>
          )}
          <Pressable onPress={() => setVisible(false)} style={styles.secondary} accessibilityRole="button">
            <Text style={[styles.secondaryText, { color: c.secondary }]}>{step < 2 ? 'Not now' : 'Done'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 22 },
  sheet: { borderRadius: 24, padding: 22, gap: 12, alignItems: 'stretch' },
  iconWrap: { alignSelf: 'center', width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  steps: { gap: 14, marginVertical: 6 },
  step: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  num: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  stepTitle: { fontSize: 15, fontWeight: '700' },
  primary: { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  secondary: { paddingVertical: 8, alignItems: 'center' },
  secondaryText: { fontSize: 15, fontWeight: '600' },
});
