import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { openAuth } from '../navigation';
import { useAccount } from '../state/AccountContext';
import { onStorySaved } from '../state/SavedContext';
import { fonts, useTheme } from '../theme';

/** White "Continue with Google" button; renders nothing until Google sign-in is set up. */
export function GoogleButton({ onDone }: { onDone?: () => void }) {
  const account = useAccount();
  const [busy, setBusy] = useState(false);
  if (!account.google) return null;
  const go = async () => {
    setBusy(true);
    try {
      if (await account.signInWithGoogle()) onDone?.();
    } catch (e) {
      Alert.alert('Google sign-in didn’t work', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Pressable onPress={go} disabled={busy} style={styles.google} accessibilityRole="button">
      {busy ? (
        <ActivityIndicator color="#111" />
      ) : (
        <>
          <Ionicons name="logo-google" size={19} color="#111" />
          <Text style={styles.googleText}>Continue with Google</Text>
        </>
      )}
    </Pressable>
  );
}

// ---- "Keep it forever?" after saving a story -------------------------------------------------

const PROMPT_KEY = 'prompt:save:v1';
const PROMPT_EVERY_MS = 3 * 24 * 60 * 60 * 1000;
/**
 * After a save, signed-out people with accounts available get a sheet offering to keep their saved
 * stories on every phone. At most once every three days, and never while signed in.
 */
export function SavePrompt() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const account = useAccount();
  const [count, setCount] = useState<number | null>(null);
  const slide = useRef(new Animated.Value(0)).current;
  const eligible = account.enabled && account.status === 'signedOut';

  useEffect(() => {
    onStorySaved(
      eligible
      ? (n) => {
          AsyncStorage.getItem(PROMPT_KEY)
            .then((last) => {
              if (Date.now() - (Number(last) || 0) < PROMPT_EVERY_MS) return;
              AsyncStorage.setItem(PROMPT_KEY, String(Date.now())).catch(() => {});
              // Let the bookmark animation land first.
              setTimeout(() => setCount(n), 450);
            })
            .catch(() => {});
        }
        : null,
    );
    return () => onStorySaved(null);
  }, [eligible]);

  useEffect(() => {
    if (count !== null) Animated.spring(slide, { toValue: 1, useNativeDriver: true, bounciness: 4 }).start();
    else slide.setValue(0);
  }, [count, slide]);

  // Signing in from the sheet closes it.
  useEffect(() => {
    if (account.status === 'signedIn') setCount(null);
  }, [account.status]);

  if (count === null) return null;
  const close = () => setCount(null);
  return (
    <Modal transparent animationType="fade" visible onRequestClose={close}>
      <Pressable style={styles.dim} onPress={close} accessibilityLabel="Close" />
      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: c.card,
            borderColor: c.border,
            paddingBottom: insets.bottom + 20,
            transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [400, 0] }) }],
          },
        ]}
      >
        <View style={[styles.grab, { backgroundColor: c.border }]} />
        <View style={styles.head}>
          <View style={[styles.mark, { backgroundColor: c.accent }]}>
            <Ionicons name="bookmark" size={26} color={c.onAccent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.eyebrow, { color: c.up }]}>✓ Saved on this phone</Text>
            <Text style={[styles.title, { color: c.text }]}>Keep it forever?</Text>
          </View>
        </View>
        <Text style={[styles.body, { color: c.secondary }]}>
          You’ve saved{' '}
          <Text style={{ color: c.text, fontWeight: '800' }}>
            {count} {count === 1 ? 'story' : 'stories'}
          </Text>
          . Create a free account so they’re there on any phone, even if you lose this one.
        </Text>
        <GoogleButton onDone={close} />
        <Pressable
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            close();
            openAuth('signup', 'back');
          }}
          style={[styles.primary, { backgroundColor: c.accent }]}
          accessibilityRole="button"
        >
          <Text style={[styles.primaryText, { color: c.onAccent }]}>Sign up with email</Text>
        </Pressable>
        <Pressable onPress={close} style={styles.later} accessibilityRole="button">
          <Text style={{ color: c.secondary, fontWeight: '700', fontSize: 15 }}>Not now</Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  google: { height: 54, borderRadius: 16, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  googleText: { color: '#111', fontSize: 16, fontWeight: '800' },
  dim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 14,
  },
  grab: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  mark: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  title: { fontFamily: fonts.heading, fontSize: 28, lineHeight: 30, textTransform: 'uppercase' },
  body: { fontSize: 15, lineHeight: 22 },
  primary: { height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontSize: 16, fontWeight: '800' },
  later: { alignItems: 'center', paddingVertical: 6 },
});
