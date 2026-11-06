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

import { goBack, openAccount, openSettings } from '../navigation';
import { useAccount } from '../state/AccountContext';
import { MINI_PLAYER_SPACE, useAudio } from '../state/AudioContext';
import { TAB_BAR_HEIGHT } from './FloatingTabBar';
import { WeatherBoundary } from './WeatherBoundary';
import { WeatherChip } from './WeatherCard';
import { getSource } from '../sources';
import { useSettings } from '../state/SettingsContext';
import { type, useTheme } from '../theme';
import type { SourceId, Topic } from '../types';

/** Space to leave at the bottom of tab screens so content clears the tab bar (and mini player). */
export function useTabBarSpace(): number {
  const { episode } = useAudio();
  return useSafeAreaInsets().bottom + TAB_BAR_HEIGHT + 20 + (episode ? MINI_PLAYER_SPACE : 0);
}

/**
 * Top of every tab: a small label ("News Hammer" or today's date) over a big condensed title,
 * with weather, account and Settings on the right.
 */
export function AppHeader({ title, eyebrow, hideWeather }: { title: string; eyebrow?: string; hideWeather?: boolean }) {
  const c = useTheme();
  return (
    <View style={styles.appHeader}>
      <View style={{ flex: 1 }}>
        <View style={styles.eyebrowRow}>
          {eyebrow ? null : <Image source={require('../../assets/icon.png')} style={styles.appLogo} contentFit="cover" />}
          <Text style={[type.eyebrow, { color: eyebrow ? c.tertiary : c.accentText }]} numberOfLines={1}>
            {eyebrow ?? 'News Hammer'}
          </Text>
        </View>
        <Text style={[type.largeTitle, { color: c.text }]} numberOfLines={1} adjustsFontSizeToFit>
          {title}
        </Text>
      </View>
      {hideWeather ? null : (
        <WeatherBoundary>
          <WeatherChip />
        </WeatherBoundary>
      )}
      <AccountButton />
      <Pressable
        onPress={openSettings}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Settings"
        style={[styles.roundButton, { backgroundColor: c.card, borderColor: c.border }]}
      >
        <Ionicons name="settings-outline" size={19} color={c.text} />
      </Pressable>
    </View>
  );
}

/** Profile circle in the app bar: your initial when signed in, a person icon when not. */
function AccountButton() {
  const c = useTheme();
  const account = useAccount();
  if (!account.enabled) return null;
  const signedIn = account.status === 'signedIn';
  return (
    <Pressable
      onPress={openAccount}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={signedIn ? `Account: ${account.email ?? ''}` : 'Sign in'}
      style={[styles.roundButton, { backgroundColor: signedIn ? c.accent : c.card, borderColor: signedIn ? c.accent : c.border }]}
    >
      {signedIn ? (
        <Text style={[styles.avatarText, { color: c.onAccent }]}>{(account.email ?? '?')[0]!.toUpperCase()}</Text>
      ) : (
        <Ionicons name="person-outline" size={17} color={c.text} />
      )}
    </Pressable>
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
      <Text style={[type.sectionTitle, styles.stackTitle, { color: c.text }]} numberOfLines={1}>
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
        <Pressable onPress={onPress} hitSlop={10} accessibilityRole="button" accessibilityLabel={`All ${title}`} style={styles.seeAll}>
          <Text style={[styles.seeAllText, { color: c.accentText }]}>See all</Text>
          <Ionicons name="chevron-forward" size={16} color={c.accentText} />
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
      style={[styles.follow, on ? { backgroundColor: c.accent, borderColor: c.accent } : { borderColor: c.border, backgroundColor: c.card }]}
    >
      <Text style={[styles.followText, { color: on ? c.onAccent : c.text }]}>{on ? 'Following' : 'Follow'}</Text>
    </Pressable>
  );
}

/** Right-aligned "More … stories >" link under a section. */
export function MoreLink({ label, onPress }: { label: string; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable onPress={onPress} style={styles.more} accessibilityRole="link" hitSlop={6}>
      <Text style={[styles.moreText, { color: c.accentText }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={c.accentText} />
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
          bottom: insets.bottom + TAB_BAR_HEIGHT + 16,
          opacity: anim,
          transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }],
        },
      ]}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Back to top"
        style={[styles.scrollTop, { backgroundColor: c.elevated, borderColor: c.border }]}
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
    <Animated.View style={[styles.skeleton, { backgroundColor: c.card, borderColor: c.border, opacity: pulse }]}>
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
    <View style={[styles.empty, { backgroundColor: c.card, borderColor: c.border }]}>
      <Ionicons name={icon} size={40} color={c.tertiary} />
      <Text style={[type.title, { color: c.text, textAlign: 'center' }]}>{title}</Text>
      <Text style={[type.body, { color: c.secondary, textAlign: 'center' }]}>{message}</Text>
      {action ? (
        <Pressable onPress={action.onPress} style={[styles.follow, { borderColor: c.accent, backgroundColor: c.accent, marginTop: 6 }]}>
          <Text style={[styles.followText, { color: c.onAccent }]}>{action.label}</Text>
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
    <View style={[styles.notice, { backgroundColor: c.card, borderColor: c.border }]}>
      <Ionicons name="cloud-offline-outline" size={16} color={c.secondary} />
      <Text style={[type.caption, { color: c.secondary, flex: 1 }]}>
        Couldn't reach {names}. Showing everything else.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  appHeader: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 14 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  appLogo: { width: 16, height: 16, borderRadius: 4 },
  roundButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, marginBottom: 2 },
  menuButton: { padding: 4 },
  avatarText: { fontSize: 16, fontWeight: '900' },
  stackHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingBottom: 10 },
  stackTitle: { flex: 1 },
  section: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingTop: 26, paddingBottom: 12 },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAllText: { fontSize: 14, fontWeight: '800' },
  follow: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 7 },
  followText: { fontSize: 14, fontWeight: '800' },
  more: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', gap: 4, paddingHorizontal: 20, paddingVertical: 10 },
  moreText: { fontSize: 14, fontWeight: '800' },
  scrollTopWrap: { position: 'absolute', alignSelf: 'center' },
  scrollTop: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  skeleton: { flexDirection: 'row', gap: 14, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, padding: 16, marginHorizontal: 14, marginBottom: 10 },
  skelHero: { borderRadius: 22, marginHorizontal: 14, marginBottom: 12, aspectRatio: 1.15 },
  skelThumb: { width: 92, height: 92, borderRadius: 14 },
  skelLine: { height: 12, borderRadius: 6 },
  empty: { alignItems: 'center', gap: 10, marginHorizontal: 14, padding: 28, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 14,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
