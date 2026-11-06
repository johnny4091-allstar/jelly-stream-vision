import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StackHeader } from '../components/common';
import type { AuthScreenProps } from '../navigation';
import { useAccount } from '../state/AccountContext';
import { fonts, useTheme } from '../theme';

/** 0–4: length, mixed case, digits, symbols. */
function strength(pw: string): number {
  if (pw.length < 6) return pw.length ? 1 : 0;
  let score = 1;
  if (pw.length >= 10) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  else if (/\d|[^A-Za-z0-9]/.test(pw)) score += 0.5;
  return Math.min(4, Math.floor(score));
}

const STRENGTH = ['', 'Too weak', 'Okay', 'Good', 'Strong'];

type Mode = 'signin' | 'signup' | 'forgot' | 'reset';

const TITLES: Record<Mode, string> = {
  signin: 'Sign in',
  signup: 'Create account',
  forgot: 'Reset password',
  reset: 'Reset password',
};

/** Email and password sign-in, sign-up and password reset (with a code from the reset email). */
export function AuthScreen({ route, navigation }: AuthScreenProps) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const account = useAccount();
  const [mode, setMode] = useState<Mode>(route.params?.mode ?? 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const done = () => {
    if (route.params?.then === 'back') navigation.goBack();
    else navigation.replace('Account');
  };

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSubmit =
    !busy &&
    validEmail &&
    (mode === 'forgot' || password.length >= 6) &&
    (mode !== 'reset' || code.trim().length >= 6);

  const submit = async () => {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (mode === 'signin') {
        await account.signIn(email, password);
        done();
      } else if (mode === 'signup') {
        const { needsConfirmation } = await account.signUp(email, password);
        if (needsConfirmation) {
          setNotice(`We sent a confirmation link to ${email.trim()}. Tap it, then come back and sign in.`);
          setMode('signin');
        } else done();
      } else if (mode === 'forgot') {
        await account.sendPasswordReset(email);
        setNotice(`We emailed a reset code to ${email.trim()}. Enter it below with a new password.`);
        setPassword('');
        setMode('reset');
      } else {
        await account.resetPassword(email, code, password);
        done();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const input = [styles.input, { backgroundColor: c.card, color: c.text, borderColor: c.border }];
  const level = mode === 'signup' || mode === 'reset' ? strength(password) : 0;
  const levelColor = level <= 1 ? c.down : level === 2 ? '#FFC53D' : c.up;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <StackHeader title={TITLES[mode]} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
          <Image source={require('../../assets/icon.png')} style={styles.logo} />
          <Text style={[styles.title, { color: c.text }]}>
            {mode === 'signup' ? 'Create your free account' : mode === 'signin' ? 'Welcome back' : 'Forgot your password?'}
          </Text>
          <Text style={[styles.sub, { color: c.secondary }]}>
            {mode === 'forgot' || mode === 'reset'
              ? 'We’ll email you a code to set a new one.'
              : 'Your saved stories, topics, teams and settings follow you to any phone.'}
          </Text>

          {notice ? (
            <View style={[styles.notice, { backgroundColor: c.card, borderColor: c.border, borderWidth: StyleSheet.hairlineWidth }]}>
              <Ionicons name="mail-outline" size={18} color={c.accentText} />
              <Text style={[styles.noticeText, { color: c.text }]}>{notice}</Text>
            </View>
          ) : null}

          <Text style={[styles.label, { color: c.secondary }]}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            style={input}
            placeholder="you@example.com"
            placeholderTextColor={c.tertiary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            accessibilityLabel="Email"
          />

          {mode === 'reset' ? (
            <>
              <Text style={[styles.label, { color: c.secondary }]}>Code from the email</Text>
              <TextInput
                value={code}
                onChangeText={setCode}
                style={input}
                placeholder="123456"
                placeholderTextColor={c.tertiary}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                accessibilityLabel="Reset code"
              />
            </>
          ) : null}

          {mode !== 'forgot' ? (
            <>
              <Text style={[styles.label, { color: c.secondary }]}>{mode === 'reset' ? 'New password' : 'Password'}</Text>
              <View>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  style={[input, { paddingRight: 48 }]}
                  placeholder={mode === 'signin' ? 'Your password' : 'At least 6 characters'}
                  placeholderTextColor={c.tertiary}
                  secureTextEntry={!show}
                  autoCapitalize="none"
                  autoComplete={mode === 'signin' ? 'password' : 'new-password'}
                  textContentType={mode === 'signin' ? 'password' : 'newPassword'}
                  onSubmitEditing={() => canSubmit && submit()}
                  accessibilityLabel="Password"
                />
                <Pressable onPress={() => setShow((s) => !s)} style={styles.eye} hitSlop={8} accessibilityRole="button" accessibilityLabel={show ? 'Hide password' : 'Show password'}>
                  <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={20} color={c.tertiary} />
                </Pressable>
              </View>
            </>
          ) : null}

          {level > 0 ? (
            <View style={{ gap: 6, marginTop: 8 }}>
              <View style={styles.meter}>
                {[1, 2, 3, 4].map((i) => (
                  <View key={i} style={[styles.meterSeg, { backgroundColor: i <= level ? levelColor : c.border }]} />
                ))}
              </View>
              <Text style={{ color: levelColor, fontSize: 13, fontWeight: '700' }}>{STRENGTH[level]} password</Text>
            </View>
          ) : null}

          {error ? <Text style={[styles.error, { color: c.down }]}>{error}</Text> : null}

          <Pressable
            onPress={submit}
            disabled={!canSubmit}
            style={[styles.primary, { backgroundColor: c.accent, opacity: canSubmit ? 1 : 0.45 }]}
            accessibilityRole="button"
          >
            {busy ? (
              <ActivityIndicator color={c.onAccent} />
            ) : (
              <Text style={[styles.primaryText, { color: c.onAccent }]}>
                {mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Email me a code' : 'Set new password'}
              </Text>
            )}
          </Pressable>

          {mode === 'signin' ? (
            <>
              <Pressable onPress={() => (setError(null), setMode('forgot'))} style={styles.link} accessibilityRole="button">
                <Text style={[styles.linkText, { color: c.accentText }]}>Forgot password?</Text>
              </Pressable>
              <Pressable onPress={() => (setError(null), setMode('signup'))} style={styles.link} accessibilityRole="button">
                <Text style={[styles.linkText, { color: c.secondary }]}>
                  New here? <Text style={{ color: c.accentText }}>Create an account</Text>
                </Text>
              </Pressable>
            </>
          ) : mode === 'signup' ? (
            <Pressable onPress={() => (setError(null), setMode('signin'))} style={styles.link} accessibilityRole="button">
              <Text style={[styles.linkText, { color: c.secondary }]}>
                Already have an account? <Text style={{ color: c.accentText }}>Sign in</Text>
              </Text>
            </Pressable>
          ) : (
            <Pressable onPress={() => (setError(null), setMode('signin'))} style={styles.link} accessibilityRole="button">
              <Text style={[styles.linkText, { color: c.accentText }]}>Back to sign in</Text>
            </Pressable>
          )}

          {mode === 'signup' ? (
            <Text style={[styles.fine, { color: c.tertiary }]}>
              Your account stores only your email, settings and saved story links. News Hammer never sells or shares it.
            </Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 20, gap: 6 },
  logo: { width: 64, height: 64, borderRadius: 16, alignSelf: 'center', marginTop: 8 },
  title: { fontFamily: fonts.display, fontSize: 40, lineHeight: 42, textTransform: 'uppercase', textAlign: 'center', marginTop: 12 },
  meter: { flexDirection: 'row', gap: 6 },
  meterSeg: { flex: 1, height: 4, borderRadius: 2 },
  sub: { fontSize: 15, lineHeight: 21, textAlign: 'center', marginBottom: 12 },
  notice: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 14, marginBottom: 6, alignItems: 'flex-start' },
  noticeText: { flex: 1, fontSize: 14, lineHeight: 20 },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 12, marginBottom: 6, marginLeft: 4 },
  input: { borderWidth: 1.5, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16 },
  eye: { position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' },
  error: { color: '#E5383B', fontSize: 14, marginTop: 10, lineHeight: 19 },
  primary: { borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 18 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  link: { alignItems: 'center', paddingVertical: 10 },
  linkText: { fontSize: 15, fontWeight: '600' },
  fine: { fontSize: 12, textAlign: 'center', lineHeight: 17, marginTop: 8 },
});
