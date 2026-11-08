import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useState, type ReactNode } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StackHeader } from '../components/common';
import { openAccount, openOnboarding } from '../navigation';
import { useAccount } from '../state/AccountContext';
import { currentVersionCode, currentVersionName } from '../services/appUpdate';
import { clearFeedCache } from '../services/news';
import { showBackgroundGuide, showBackgroundGuideOnce } from '../components/BackgroundGuide';
import { runCheck, sendTestNotification, setUpNotifications } from '../services/notifications';
import type { TempUnit } from '../services/weather';
import { SOURCES } from '../sources';
import { useSettings, type ThemeMode } from '../state/SettingsContext';
import { type, useTheme } from '../theme';

const UNITS: { id: TempUnit; label: string }[] = [
  { id: 'f', label: '°F' },
  { id: 'c', label: '°C' },
];

const MODES: { id: ThemeMode; label: string }[] = [
  { id: 'dark', label: 'Dark' },
  { id: 'light', label: 'Light' },
  { id: 'system', label: 'Match phone' },
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
  const {
    themeMode,
    setThemeMode,
    isEnabled,
    setSourceEnabled,
    notifyTopStories,
    setNotifyTopStories,
    notifyUpdates,
    setNotifyUpdates,
    briefingAlert,
    setBriefingAlert,
    recapAlert,
    setRecapAlert,
    liveScoreAlert,
    setLiveScoreAlert,
    showWeather,
    setShowWeather,
    tempUnit,
    setTempUnit,
    showMarkets,
    setShowMarkets,
    showMedia,
    setShowMedia,
  } = useSettings();
  const [checking, setChecking] = useState(false);
  const account = useAccount();

  const permissionOff = () =>
    Alert.alert('Notifications are off', 'Allow notifications for News Hammer in your phone settings.', [
      { text: 'Not now', style: 'cancel' },
      { text: 'Open settings', onPress: () => Linking.openSettings().catch(() => {}) },
    ]);

  const toggle = (set: (on: boolean) => void) => async (on: boolean) => {
    set(on);
    if (!on) return;
    if (await setUpNotifications().catch(() => false)) await showBackgroundGuideOnce();
    else permissionOff();
  };

  const testNotification = async () => {
    if (!(await sendTestNotification().catch(() => false))) permissionOff();
  };

  const checkNow = async () => {
    setChecking(true);
    try {
      if (!(await setUpNotifications().catch(() => false))) return permissionOff();
      const { stories, update } = await runCheck();
      if (stories === 0 && !update) Alert.alert("You're up to date", 'No new top stories since the last check.');
    } finally {
      setChecking(false);
    }
  };

  const versionName = currentVersionName();
  const versionCode = currentVersionCode();

  const clearCache = async () => {
    await clearFeedCache();
    Alert.alert('Cache cleared', 'Stories will be fetched fresh next time.');
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <StackHeader title="Settings" />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>

      {account.enabled ? (
        <Section title="Account" footer="A free account keeps your saved stories, topics, teams and settings in sync on every phone.">
          <Pressable onPress={openAccount} style={styles.row} accessibilityRole="button">
            <Text style={[styles.rowLabel, { color: account.status === 'signedIn' ? c.text : c.accentText }]} numberOfLines={1}>
              {account.status === 'signedIn' ? `Signed in as ${account.email ?? ''}` : 'Sign in or create an account'}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={c.tertiary} />
          </Pressable>
        </Section>
      ) : null}

      <Section title="Appearance" footer="News Hammer is designed dark first. Match phone follows your phone's light or dark setting.">
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

      <Section
        title="Weather"
        footer="Uses your phone's location only while News Hammer is open. Forecasts come from Open-Meteo.com."
      >
        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: c.text }]}>Show local weather</Text>
          <Switch
            value={showWeather}
            onValueChange={setShowWeather}
            trackColor={{ true: c.accent, false: c.border }}
            thumbColor="#F5F5F7"
            accessibilityLabel="Show local weather"
          />
        </View>
        <View style={[styles.segment, { backgroundColor: c.chip }]}>
          {UNITS.map((u) => {
            const active = u.id === tempUnit;
            return (
              <Pressable
                key={u.id}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setTempUnit(u.id);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                style={[styles.segmentItem, active && { backgroundColor: c.elevated }, active && styles.segmentShadow]}
              >
                <Text style={{ color: c.text, fontWeight: active ? '700' : '500', fontSize: 15 }}>{u.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </Section>

      <Section title="Markets" footer="Major indexes, Bitcoin, gold, oil and the 10-year Treasury yield from Yahoo Finance. Prices may be delayed.">
        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: c.text }]}>Show stock market on Today</Text>
          <Switch
            value={showMarkets}
            onValueChange={setShowMarkets}
            trackColor={{ true: c.accent, false: c.border }}
            thumbColor="#F5F5F7"
            accessibilityLabel="Show stock market on Today"
          />
        </View>
      </Section>

      <Section
        title="Videos & podcasts"
        footer="Latest videos and podcasts are always on the Watch tab. Podcasts keep playing with the screen off."
      >
        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: c.text }]}>Show podcast on Today</Text>
          <Switch
            value={showMedia}
            onValueChange={setShowMedia}
            trackColor={{ true: c.accent, false: c.border }}
            thumbColor="#F5F5F7"
            accessibilityLabel="Show podcast on Today"
          />
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
              trackColor={{ true: c.accent, false: c.border }}
            thumbColor="#F5F5F7"
              accessibilityLabel={`${s.name} stories`}
            />
          </View>
        ))}
      </Section>

      <Section
        title="Notifications"
        footer="News Hammer checks your sources in the background every 15 minutes or so. Android may wait longer to save battery; on Samsung phones, allow it to run in the background so alerts arrive on time."
      >
        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: c.text }]}>New top stories</Text>
          <Switch
            value={notifyTopStories}
            onValueChange={toggle(setNotifyTopStories)}
            trackColor={{ true: c.accent, false: c.border }}
            thumbColor="#F5F5F7"
            accessibilityLabel="Notify me about new top stories"
          />
        </View>
        <View style={[styles.row, styles.divider, { borderTopColor: c.separator }]}>
          <Text style={[styles.rowLabel, { color: c.text }]}>App updates</Text>
          <Switch
            value={notifyUpdates}
            onValueChange={toggle(setNotifyUpdates)}
            trackColor={{ true: c.accent, false: c.border }}
            thumbColor="#F5F5F7"
            accessibilityLabel="Notify me when a new version is available"
          />
        </View>
        <View style={[styles.row, styles.divider, { borderTopColor: c.separator }]}>
          <Text style={[styles.rowLabel, { color: c.text }]}>Morning briefing at 7 AM</Text>
          <Switch
            value={briefingAlert}
            onValueChange={toggle(setBriefingAlert)}
            trackColor={{ true: c.accent, false: c.border }}
            thumbColor="#F5F5F7"
            accessibilityLabel="Notify me when my morning briefing is ready"
          />
        </View>
        <View style={[styles.row, styles.divider, { borderTopColor: c.separator }]}>
          <Text style={[styles.rowLabel, { color: c.text }]}>Evening recap at 8 PM</Text>
          <Switch
            value={recapAlert}
            onValueChange={toggle(setRecapAlert)}
            trackColor={{ true: c.accent, false: c.border }}
            thumbColor="#F5F5F7"
            accessibilityLabel="Notify me when my evening recap is ready"
          />
        </View>
        <View style={[styles.row, styles.divider, { borderTopColor: c.separator }]}>
          <Text style={[styles.rowLabel, { color: c.text }]}>Your team's live score on the lock screen</Text>
          <Switch
            value={liveScoreAlert}
            onValueChange={toggle(setLiveScoreAlert)}
            trackColor={{ true: c.accent, false: c.border }}
            thumbColor="#F5F5F7"
            accessibilityLabel="Show my team's live score on the lock screen"
          />
        </View>
        <Pressable onPress={showBackgroundGuide} style={[styles.row, styles.divider, { borderTopColor: c.separator }]} accessibilityRole="button">
          <Text style={[styles.rowLabel, { color: c.accentText }]}>Allow running in the background</Text>
        </Pressable>
        <Pressable onPress={checkNow} disabled={checking} style={[styles.row, styles.divider, { borderTopColor: c.separator }]} accessibilityRole="button">
          <Text style={[styles.rowLabel, { color: c.accentText }]}>{checking ? 'Checking…' : 'Check for news now'}</Text>
        </Pressable>
        <Pressable onPress={testNotification} style={[styles.row, styles.divider, { borderTopColor: c.separator }]} accessibilityRole="button">
          <Text style={[styles.rowLabel, { color: c.accentText }]}>Send a test notification</Text>
        </Pressable>
      </Section>

      <Section title="Setup">
        <Pressable onPress={openOnboarding} style={styles.row} accessibilityRole="button">
          <Text style={[styles.rowLabel, { color: c.accentText }]}>Run setup again</Text>
        </Pressable>
      </Section>

      <Section title="Data" footer="Feeds are cached for 10 minutes so the app opens fast.">
        <Pressable onPress={clearCache} style={styles.row} accessibilityRole="button">
          <Text style={[styles.rowLabel, { color: c.accentText }]}>Clear feed cache</Text>
        </Pressable>
      </Section>

      <Section title="About">
        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: c.text }]}>Version</Text>
          <Text style={{ color: c.tertiary, fontSize: 17 }}>
            {versionName ? `${versionName}${versionCode ? ` (build ${versionCode})` : ''}` : 'Development'}
          </Text>
        </View>
      </Section>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 18, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '600', letterSpacing: 0.3, marginLeft: 16, marginBottom: 8 },
  group: { borderRadius: 14, overflow: 'hidden' },
  footer: { marginHorizontal: 16, marginTop: 8, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, minHeight: 50, gap: 12 },
  rowLabel: { flex: 1, fontSize: 17 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth },
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
