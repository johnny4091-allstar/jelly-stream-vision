import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StackHeader } from '../components/common';
import { openAuth } from '../navigation';
import { useAccount } from '../state/AccountContext';
import { useTheme } from '../theme';
import { timeAgo } from '../utils';

/** Who's signed in, sync status, sign out and delete account; or the reasons to sign up. */
export function AccountScreen() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const account = useAccount();
  const [busy, setBusy] = useState(false);

  const confirmDelete = () =>
    Alert.alert(
      'Delete your account?',
      'This permanently deletes your account and the settings and saved stories stored with it. What’s on this phone stays.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await account.deleteAccount();
              Alert.alert('Account deleted', 'Your account and its data are gone.');
            } catch (e) {
              Alert.alert('Couldn’t delete the account', e instanceof Error ? e.message : String(e));
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );

  const row = (icon: keyof typeof Ionicons.glyphMap, text: string) => (
    <View style={styles.perk} key={text}>
      <Ionicons name={icon} size={20} color={c.accent} />
      <Text style={[styles.perkText, { color: c.text }]}>{text}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <StackHeader title="Account" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 14 }}>
        {!account.enabled ? (
          <View style={[styles.card, { backgroundColor: c.card }]}>
            <Text style={[styles.h, { color: c.text }]}>Accounts are coming soon</Text>
            <Text style={{ color: c.secondary, fontSize: 15, lineHeight: 21 }}>
              Sign-in isn’t switched on in this version yet. Everything you do is saved on this phone.
            </Text>
          </View>
        ) : account.status === 'loading' ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={c.tertiary} />
        ) : account.status === 'signedIn' ? (
          <>
            <View style={[styles.card, styles.who, { backgroundColor: c.card }]}>
              <View style={[styles.avatar, { backgroundColor: c.accent }]}>
                <Text style={styles.avatarText}>{(account.email ?? '?')[0]!.toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.h, { color: c.text, marginBottom: 2 }]} numberOfLines={1}>
                  {account.email}
                </Text>
                <Text style={{ color: account.syncError ? '#E5383B' : c.tertiary, fontSize: 13 }}>
                  {account.syncError
                    ? `Sync problem: ${account.syncError}`
                    : account.lastSync
                      ? `Synced ${timeAgo(account.lastSync).toLowerCase()}`
                      : 'Syncing…'}
                </Text>
              </View>
            </View>
            <View style={[styles.card, { backgroundColor: c.card, gap: 12 }]}>
              {row('bookmark-outline', 'Saved stories')}
              {row('star-outline', 'Followed topics and starred teams')}
              {row('options-outline', 'Sources, weather, markets and notification settings')}
              <Text style={{ color: c.tertiary, fontSize: 13 }}>These sync to any phone where you sign in.</Text>
            </View>
            <Pressable onPress={() => account.signOut()} style={[styles.button, { backgroundColor: c.card }]} accessibilityRole="button">
              <Text style={[styles.buttonText, { color: c.text }]}>Sign out</Text>
            </Pressable>
            <Pressable onPress={confirmDelete} disabled={busy} style={[styles.button, { backgroundColor: c.card }]} accessibilityRole="button">
              {busy ? <ActivityIndicator color="#E5383B" /> : <Text style={[styles.buttonText, { color: '#E5383B' }]}>Delete account</Text>}
            </Pressable>
          </>
        ) : (
          <>
            <View style={[styles.card, { backgroundColor: c.card, gap: 12 }]}>
              <Text style={[styles.h, { color: c.text }]}>Get more with a free account</Text>
              {row('sync-outline', 'Your saved stories, topics and teams on every phone')}
              {row('shield-checkmark-outline', 'Back up your settings if you change phones')}
              {row('lock-closed-outline', 'Just your email and a password. Nothing is sold or shared')}
            </View>
            <Pressable onPress={() => openAuth('signup')} style={[styles.button, { backgroundColor: c.accent }]} accessibilityRole="button">
              <Text style={[styles.buttonText, { color: '#fff' }]}>Create account</Text>
            </Pressable>
            <Pressable onPress={() => openAuth('signin')} style={[styles.button, { backgroundColor: c.card }]} accessibilityRole="button">
              <Text style={[styles.buttonText, { color: c.text }]}>Sign in</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, padding: 16 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 22, fontWeight: '800' },
  h: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  perk: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  perkText: { flex: 1, fontSize: 15, lineHeight: 20 },
  button: { borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  buttonText: { fontSize: 16, fontWeight: '800' },
});
