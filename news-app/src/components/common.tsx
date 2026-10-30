import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { goBack, openSettings } from '../navigation';
import { MINI_PLAYER_SPACE, useAudio } from '../state/AudioContext';
import { WeatherBoundary } from './WeatherBoundary';
import { WeatherChip } from './WeatherCard';
import { getSource } from '../sources';
import { useSettings } from '../state/SettingsContext';
import { type, useTheme } from '../theme';
import type { SourceId, Topic } from '../types';

/** Space to leave at the bottom of tab screens so content clears the floating tab bar. */
export function useTabBarSpace(): number {
  const { episode } = useAudio();
  return useSafeAreaInsets().bottom + 104 + (episode ? MINI_PLAYER_SPACE : 0);
}

/** App bar on the tab screens: logo and name on the left, menu (Settings) on the right. */
export function AppHeader() {
  const c = useTheme();
  return (
    <View style={styles.appHeader}>
      <Image source={require('../../assets/icon.png')} style={styles.appLogo} contentFit="cover" />
      <Text style={[styles.appName, { color: c.text }]}>
        News <Text style={{ color: c.accent }}>Hammer</Text>
      </Text>
      <WeatherBoundary>
        <WeatherChip />
      </WeatherBoundary>
      <Pressable
        onPress={openSettings}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Settings"
        style={styles.menuButton}
      >
        <Ionicons name="ellipsis-vertical" size={20} color={c.text} />
      </Pressable>
    </View>
  );
}

/** Header for pushed screens: back arrow, title, optional right-hand control. */
export function StackHeader({ title, right }: { title: string; right?: ReactNode }) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.stackHeader, { paddingTop: insets.top + 6, backgroundColor: c.background }]}>
      <Pressable onPress={goBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back" style={styles.menuButton}>
        <Ionicons name="arrow-back" size={24} color={c.text} />
      </Pressable>
      <Text style={[styles.stackTitle, { color: c.text }]} numberOfLines={1}>
        {title}
      </Text>
      {right}
    </View>
  );
}

/** Large section title ("Top stories", "Politics") with an optional subtitle and right-hand controls. */
export function SectionHeader({
  title,
  subtitle,
  onPress,
  right,
}: {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  right?: ReactNode;
}) {
  const c = useTheme();
  return (
    <View style={styles.section}>
      <View style={{ flex: 1 }}>
        <Text style={[type.sectionTitle, { color: c.text }]}>{title}</Text>
        {subtitle ? <Text style={[type.caption, { color: c.tertiary, marginTop: 2 }]}>{subtitle}</Text> : null}
      </View>
      {right}
      {onPress ? (
        <Pressable onPress={onPress} hitSlop={10} accessibilityRole="button" accessibilityLabel={`All ${title}`}>
          <Ionicons name="chevron-forward" size={26} color={c.text} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Outlined Follow / Following pill for a topic. */
export function FollowButton({ topic }: { topic: Topic }) {
  const c = useTheme();
  const { isFollowing, setFollowing } = useSettings();
  const on = isFollowing(topic);
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        setFollowing(topic, !on);
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={[styles.follow, on ? { backgroundColor: c.chipActive, borderColor: c.chipActive } : { borderColor: c.text }]}
    >
      <Text style={[styles.followText, { color: on ? c.chipActiveText : c.text }]}>{on ? 'Following' : 'Follow'}</Text>
    </Pressable>
  );
}

/** Right-aligned "More … stories >" link under a section. */
export function MoreLink({ label, onPress }: { label: string; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable onPress={onPress} style={styles.more} accessibilityRole="link" hitSlop={6}>
      <Text style={[styles.moreText, { color: c.text }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={c.text} />
    </Pressable>
  );
}

/**
 * Tracks whether a list has scrolled far enough to show the scroll-to-top button.
 * Spread `onScroll` onto the list and render <ScrollTopButton visible={…} onPress={…} />.
 */
export function useScrollTopVisibility(threshold = 900) {
  const [visible, setVisible] = useState(false);
  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const show = e.nativeEvent.contentOffset.y > threshold;
      setVisible((v) => (v === show ? v : show));
    },
    [threshold],
  );
  return { visible, onScroll, scrollEventThrottle: 64 };
}

/** Round button floating above the tab bar that jumps back to the top. */
export function ScrollTopButton({ visible, onPress }: { visible: boolean; onPress: () => void }) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: visible ? 1 : 0, duration: 180, useNativeDriver: true }).start();
  }, [anim, visible]);
  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[
        styles.scrollTopWrap,
        {
          bottom: insets.bottom + 96,
          opacity: anim,
          transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }],
        },
      ]}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Back to top"
        style={[styles.scrollTop, { backgroundColor: c.elevated }]}
      >
        <Ionicons name="chevron-up" size={26} color={c.text} />
      </Pressable>
    </Animated.View>
  );
}

/** Pulsing placeholder card shown while the first load is in flight. */
export function SkeletonCard({ hero = false }: { hero?: boolean }) {
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
  if (hero) {
    return <Animated.View style={[styles.skelHero, { backgroundColor: c.skeleton, opacity: pulse }]} />;
  }
  return (
    <Animated.View style={[styles.skeleton, { backgroundColor: c.card, opacity: pulse }]}>
      <View style={{ flex: 1, gap: 10 }}>
        <View style={[styles.skelLine, { width: '30%', backgroundColor: c.skeleton }]} />
        <View style={[styles.skelLine, { height: 16, width: '95%', backgroundColor: c.skeleton }]} />
        <View style={[styles.skelLine, { height: 16, width: '70%', backgroundColor: c.skeleton }]} />
      </View>
      <View style={[styles.skelThumb, { backgroundColor: c.skeleton }]} />
    </Animated.View>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  action?: { label: string; onPress: () => void };
}) {
  const c = useTheme();
  return (
    <View style={[styles.empty, { backgroundColor: c.card }]}>
      <Ionicons name={icon} size={40} color={c.tertiary} />
      <Text style={[type.title, { color: c.text, textAlign: 'center' }]}>{title}</Text>
      <Text style={[type.body, { color: c.secondary, textAlign: 'center' }]}>{message}</Text>
      {action ? (
        <Pressable onPress={action.onPress} style={[styles.follow, { borderColor: c.text, marginTop: 6 }]}>
          <Text style={[styles.followText, { color: c.text }]}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Quiet notice listing feeds that couldn't be loaded this time. */
export function FailedNotice({ failed }: { failed: SourceId[] }) {
  const c = useTheme();
  if (failed.length === 0) return null;
  // Name a few; offline, nearly every source fails and the list would fill the screen.
  const names = failed.length <= 3 ? failed.map((id) => getSource(id)?.name ?? id).join(', ') : `${failed.length} sources`;
  return (
    <View style={[styles.notice, { backgroundColor: c.card }]}>
      <Ionicons name="cloud-offline-outline" size={16} color={c.secondary} />
      <Text style={[type.caption, { color: c.secondary, flex: 1 }]}>
        Couldn't reach {names}. Showing everything else.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  appHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 14 },
  appLogo: { width: 30, height: 30, borderRadius: 8 },
  appName: { flex: 1, fontSize: 21, fontWeight: '800', letterSpacing: -0.2 },
  menuButton: { padding: 4 },
  stackHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingBottom: 10 },
  stackTitle: { flex: 1, fontSize: 21, fontWeight: '800' },
  section: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingTop: 28, paddingBottom: 14 },
  follow: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 7 },
  followText: { fontSize: 15, fontWeight: '700' },
  more: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', gap: 4, paddingHorizontal: 20, paddingVertical: 10 },
  moreText: { fontSize: 15, fontWeight: '600' },
  scrollTopWrap: { position: 'absolute', alignSelf: 'center' },
  scrollTop: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  skeleton: { flexDirection: 'row', gap: 14, borderRadius: 20, padding: 16, marginHorizontal: 12, marginBottom: 10 },
  skelHero: { borderRadius: 22, marginHorizontal: 12, marginBottom: 12, aspectRatio: 1.15 },
  skelThumb: { width: 92, height: 92, borderRadius: 14 },
  skelLine: { height: 12, borderRadius: 6 },
  empty: { alignItems: 'center', gap: 10, marginHorizontal: 12, padding: 28, borderRadius: 20 },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 12,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
  },
});
