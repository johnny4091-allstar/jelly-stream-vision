import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { getSource } from '../sources';
import { type, useTheme } from '../theme';
import type { SourceId } from '../types';

export function ScreenHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  const c = useTheme();
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        {subtitle ? <Text style={[styles.subtitle, { color: c.tertiary }]}>{subtitle.toUpperCase()}</Text> : null}
        <Text style={[type.largeTitle, { color: c.text }]}>{title}</Text>
      </View>
      {right}
    </View>
  );
}

/** Pulsing placeholder card shown while the first load is in flight. */
export function SkeletonCard() {
  const c = useTheme();
  const pulse = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <Animated.View style={[styles.skeleton, { backgroundColor: c.card, opacity: pulse }]}>
      <View style={[styles.skelImage, { backgroundColor: c.skeleton }]} />
      <View style={{ padding: 16, gap: 10 }}>
        <View style={[styles.skelLine, { width: '30%', backgroundColor: c.skeleton }]} />
        <View style={[styles.skelLine, { height: 18, width: '90%', backgroundColor: c.skeleton }]} />
        <View style={[styles.skelLine, { height: 18, width: '70%', backgroundColor: c.skeleton }]} />
      </View>
    </Animated.View>
  );
}

export function EmptyState({ icon, title, message }: { icon: keyof typeof Ionicons.glyphMap; title: string; message: string }) {
  const c = useTheme();
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={44} color={c.tertiary} />
      <Text style={[type.title, { color: c.text, textAlign: 'center' }]}>{title}</Text>
      <Text style={[type.body, { color: c.secondary, textAlign: 'center' }]}>{message}</Text>
    </View>
  );
}

/** Quiet notice listing feeds that couldn't be loaded this time. */
export function FailedNotice({ failed }: { failed: SourceId[] }) {
  const c = useTheme();
  if (failed.length === 0) return null;
  const names = failed.map((id) => getSource(id)?.name ?? id).join(', ');
  return (
    <View style={[styles.notice, { backgroundColor: c.chip }]}>
      <Ionicons name="cloud-offline-outline" size={16} color={c.secondary} />
      <Text style={[type.caption, { color: c.secondary, flex: 1 }]}>
        Couldn't reach {names}. Showing everything else.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12 },
  subtitle: { fontSize: 13, fontWeight: '700', letterSpacing: 0.4, marginBottom: 2 },
  skeleton: { borderRadius: 18, overflow: 'hidden', marginHorizontal: 16, marginBottom: 16 },
  skelImage: { width: '100%', aspectRatio: 16 / 9 },
  skelLine: { height: 12, borderRadius: 6 },
  empty: { alignItems: 'center', gap: 10, paddingHorizontal: 40, paddingTop: 80 },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
});
