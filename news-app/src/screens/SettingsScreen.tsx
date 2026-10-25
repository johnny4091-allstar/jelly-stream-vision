import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '../components/common';
import { clearFeedCache } from '../services/news';
import { SOURCES } from '../sources';
import { useSettings, type ThemeMode } from '../state/SettingsContext';
import { type, useTheme } from '../theme';

const MODES: { id: ThemeMode; label: string }[] = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
];

function Section({ title, footer, children }: { title: string; footer?: string; children: ReactNode }) {
  const c = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: c.tertiary }]}>{title.toUpperCase()}</Text>
      <View style={[styles.group, { backgroundColor: c.card }]}>{children}</View>
      {footer ? <Text style={[type.caption, styles.footer, { color: c.tertiary }]}>{footer}</Text> : null}
    </View>
  );
}

export function SettingsScreen() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { themeMode, setThemeMode, isEnabled, setSourceEnabled } = useSettings();

  const clearCache = async () => {
    await clearFeedCache();
    Alert.alert('Cache cleared', 'Stories will be fetched fresh next time.');
  };

  return (
    <ScrollView
      style={{ backgroundColor: c.background }}
      contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 32 }}
    >
      <ScreenHeader title="Settings" />

      <Section title="Appearance" footer="System follows your phone's light or dark setting.">
        <View style={[styles.segment, { backgroundColor: c.chip }]}>
          {MODES.map((m) => {
            const active = m.id === themeMode;
            return (
              <Pressable
                key={m.id}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setThemeMode(m.id);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                style={[styles.segmentItem, active && { backgroundColor: c.elevated }, active && styles.segmentShadow]}
              >
                <Text style={{ color: c.text, fontWeight: active ? '700' : '500', fontSize: 15 }}>{m.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </Section>

      <Section title="Sources" footer="Stories come from each outlet's public RSS feed. Articles open on the publisher's site.">
        {SOURCES.map((s, i) => (
          <View
            key={s.id}
            style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.separator }]}
          >
            <View style={[styles.dot, { backgroundColor: s.color }]} />
            <Text style={[styles.rowLabel, { color: c.text }]}>{s.name}</Text>
            <Switch
              value={isEnabled(s.id)}
              onValueChange={(on) => setSourceEnabled(s.id, on)}
              trackColor={{ true: '#34C759' }}
              accessibilityLabel={`${s.name} stories`}
            />
          </View>
        ))}
      </Section>

      <Section title="Data" footer="Feeds are cached for 10 minutes so the app opens fast.">
        <Pressable onPress={clearCache} style={styles.row} accessibilityRole="button">
          <Text style={[styles.rowLabel, { color: c.accent }]}>Clear feed cache</Text>
        </Pressable>
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 18, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '600', letterSpacing: 0.3, marginLeft: 16, marginBottom: 8 },
  group: { borderRadius: 14, overflow: 'hidden' },
  footer: { marginHorizontal: 16, marginTop: 8, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, minHeight: 50, gap: 12 },
  rowLabel: { flex: 1, fontSize: 17 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  segment: { flexDirection: 'row', margin: 10, padding: 3, borderRadius: 10 },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8 },
  segmentShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
});
