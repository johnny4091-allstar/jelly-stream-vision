import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Linking, Modal, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type, useTheme } from '../theme';

export interface ShareItem {
  title: string;
  link: string;
}

// A tiny event hub, like the background guide's, so any card or screen can open the sheet.
const listeners = new Set<(item: ShareItem) => void>();
export function openShareSheet(item: ShareItem): void {
  listeners.forEach((l) => l(item));
}

const enc = encodeURIComponent;

interface Target {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  /** Web links open the app when it's installed (Android app links), the website when it isn't. */
  url: (item: ShareItem) => string;
}

const TARGETS: Target[] = [
  { id: 'sms', label: 'Messages', icon: 'chatbubble', color: '#1E88E5', url: (i) => `sms:?body=${enc(`${i.title}\n${i.link}`)}` },
  { id: 'whatsapp', label: 'WhatsApp', icon: 'logo-whatsapp', color: '#25D366', url: (i) => `https://wa.me/?text=${enc(`${i.title}\n${i.link}`)}` },
  { id: 'facebook', label: 'Facebook', icon: 'logo-facebook', color: '#1877F2', url: (i) => `https://www.facebook.com/sharer/sharer.php?u=${enc(i.link)}` },
  { id: 'x', label: 'X', icon: 'logo-x', color: '#000000', url: (i) => `https://twitter.com/intent/tweet?text=${enc(i.title)}&url=${enc(i.link)}` },
  { id: 'telegram', label: 'Telegram', icon: 'paper-plane', color: '#229ED9', url: (i) => `https://t.me/share/url?url=${enc(i.link)}&text=${enc(i.title)}` },
  { id: 'reddit', label: 'Reddit', icon: 'logo-reddit', color: '#FF4500', url: (i) => `https://www.reddit.com/submit?url=${enc(i.link)}&title=${enc(i.title)}` },
  { id: 'email', label: 'Email', icon: 'mail', color: '#6B7280', url: (i) => `mailto:?subject=${enc(i.title)}&body=${enc(`${i.title}\n\n${i.link}`)}` },
];

/** One-tap sharing to the apps people use most, plus copy link and the phone's full share menu. */
export function ShareSheet() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const [item, setItem] = useState<ShareItem | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const open = (i: ShareItem) => {
      setCopied(false);
      setItem(i);
    };
    listeners.add(open);
    return () => {
      listeners.delete(open);
    };
  }, []);

  const close = () => setItem(null);
  const go = (fn: () => Promise<unknown>) => () => {
    Haptics.selectionAsync().catch(() => {});
    fn().catch(() => {});
    close();
  };

  if (!item) return null;
  const tile = (key: string, label: string, icon: keyof typeof Ionicons.glyphMap, color: string, onPress: () => void) => (
    <Pressable key={key} onPress={onPress} style={styles.tile} accessibilityRole="button" accessibilityLabel={`Share to ${label}`}>
      <View style={[styles.circle, { backgroundColor: color }]}>
        <Ionicons name={icon} size={24} color="#fff" />
      </View>
      <Text style={[styles.label, { color: c.text }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <Modal transparent animationType="slide" visible onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Close" />
      <View style={[styles.sheet, { backgroundColor: c.card, paddingBottom: insets.bottom + 16 }]}>
        <View style={[styles.handle, { backgroundColor: c.separator }]} />
        <Text style={[type.meta, { color: c.tertiary }]}>SHARE</Text>
        <Text style={[type.rowTitle, { color: c.text }]} numberOfLines={2}>
          {item.title}
        </Text>
        <View style={styles.grid}>
          {TARGETS.map((t) => tile(t.id, t.label, t.icon, t.color, go(() => Linking.openURL(t.url(item)))))}
          {tile('copy', copied ? 'Copied' : 'Copy link', copied ? 'checkmark' : 'copy', '#4B5563', () => {
            Clipboard.setStringAsync(item.link)
              .then(() => {
                setCopied(true);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                setTimeout(close, 700);
              })
              .catch(() => {});
          })}
          {tile('more', 'More', 'share-social', c.accent, go(() => Share.share({ title: item.title, message: `${item.title}\n${item.link}` })))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingTop: 10, gap: 6 },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, rowGap: 16 },
  tile: { width: '25%', alignItems: 'center', gap: 6 },
  circle: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 12, fontWeight: '600' },
});
