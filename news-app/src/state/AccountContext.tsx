import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import * as WebBrowser from 'expo-web-browser';

import { AUTH_REDIRECT, accountsEnabled, googleEnabled, supabase } from '../services/supabase';
import type { Story } from '../types';
import { useSaved } from './SavedContext';
import { useSettings, type StoredSettings } from './SettingsContext';

export type AccountStatus = 'disabled' | 'loading' | 'signedOut' | 'signedIn';

interface AccountValue {
  enabled: boolean;
  /** Whether "Continue with Google" is set up. */
  google: boolean;
  status: AccountStatus;
  email: string | null;
  /** When this phone last saved to or loaded from the account. */
  lastSync: number | null;
  syncError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  /** Resolves `needsConfirmation` when the project asks new users to confirm their email first. */
  signUp: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>;
  /** Opens Google's sign-in page; resolves false if the user closed it. */
  signInWithGoogle: () => Promise<boolean>;
  signOut: () => Promise<void>;
  /** Emails a reset code (and link) to the address. */
  sendPasswordReset: (email: string) => Promise<void>;
  /** Signs in with the emailed code and sets the new password. */
  resetPassword: (email: string, code: string, password: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AccountContext = createContext<AccountValue | null>(null);

/** Plain-English versions of Supabase's auth errors. */
function friendly(err: unknown): Error {
  const msg = err instanceof Error ? err.message : String(err);
  if (/invalid login credentials/i.test(msg)) return new Error('That email and password don’t match an account.');
  if (/email not confirmed/i.test(msg)) return new Error('Confirm your email first: tap the link we sent you, then sign in.');
  if (/already registered|already exists/i.test(msg)) return new Error('There’s already an account with that email. Sign in instead.');
  if (/password should be at least/i.test(msg)) return new Error('Use a password with at least 6 characters.');
  if (/token has expired|invalid/i.test(msg) && /otp|token/i.test(msg)) return new Error('That code is wrong or has expired. Ask for a new one.');
  if (/network|fetch/i.test(msg)) return new Error('Can’t reach the server. Check your connection and try again.');
  if (/rate limit/i.test(msg)) return new Error('Too many tries. Wait a minute and try again.');
  return new Error(msg);
}

// Settings that sync; everything a person chose, nothing tied to this phone.
type Synced = Partial<StoredSettings>;

/** Saved stories from both sides, newest saves first, each once. */
function mergeSaved(local: Story[], remote: Story[]): Story[] {
  const seen = new Set<string>();
  return [...local, ...remote].filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true))).slice(0, 500);
}

/**
 * Optional account. When signed in, followed topics, sources, starred teams, settings and saved
 * stories follow the user to any phone: pulled once at sign-in (merged with what's on this phone),
 * then pushed a couple of seconds after each change.
 */
export function AccountProvider({ children }: { children: ReactNode }) {
  const { snapshot, applySynced, ready } = useSettings();
  const { saved, replaceSaved } = useSaved();
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AccountStatus>(accountsEnabled ? 'loading' : 'disabled');
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const pulledFor = useRef<string | null>(null);
  const latest = useRef({ snapshot, saved });
  latest.current = { snapshot, saved };

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setStatus(data.session ? 'signedIn' : 'signedOut');
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setStatus(s ? 'signedIn' : 'signedOut');
      if (!s) pulledFor.current = null;
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const push = useCallback(async (userId: string) => {
    if (!supabase) return;
    const { snapshot: s, saved: sv } = latest.current;
    const { error } = await supabase
      .from('profiles')
      .upsert({ user_id: userId, settings: s, saved: sv, updated_at: new Date().toISOString() });
    if (error) setSyncError(error.message);
    else {
      setSyncError(null);
      setLastSync(Date.now());
    }
  }, []);

  // First pull after sign-in: merge the account into this phone, then save the result back.
  useEffect(() => {
    const userId = session?.user.id;
    if (!supabase || !userId || !ready || pulledFor.current === userId) return;
    pulledFor.current = userId;
    (async () => {
      const { data, error } = await supabase.from('profiles').select('settings, saved').eq('user_id', userId).maybeSingle();
      if (error) {
        setSyncError(error.message);
        return;
      }
      if (data) {
        const remote = data as { settings: Synced; saved: Story[] };
        if (remote.settings && Object.keys(remote.settings).length) applySynced(remote.settings);
        replaceSaved(mergeSaved(latest.current.saved, remote.saved ?? []));
      }
      // Let the merged state land before saving it.
      setTimeout(() => push(userId), 500);
    })();
  }, [session, ready, applySynced, replaceSaved, push]);

  // After that, save changes a moment after they happen.
  useEffect(() => {
    const userId = session?.user.id;
    if (!userId || pulledFor.current !== userId) return;
    const timer = setTimeout(() => push(userId), 2000);
    return () => clearTimeout(timer);
  }, [snapshot, saved, session, push]);

  const value = useMemo<AccountValue>(() => {
    const need = () => {
      if (!supabase) throw new Error('Accounts aren’t set up in this version of the app.');
      return supabase;
    };
    return {
      enabled: accountsEnabled,
      google: googleEnabled,
      status,
      email: session?.user.email ?? null,
      lastSync,
      syncError,
      signIn: async (email, password) => {
        const { error } = await need().auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw friendly(error);
      },
      signUp: async (email, password) => {
        const { data, error } = await need().auth.signUp({ email: email.trim(), password });
        if (error) throw friendly(error);
        // An existing confirmed address comes back with no identities instead of an error.
        if (data.user && data.user.identities?.length === 0) throw friendly(new Error('already registered'));
        return { needsConfirmation: !data.session };
      },
      signInWithGoogle: async () => {
        const client = need();
        const { data, error } = await client.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: AUTH_REDIRECT, skipBrowserRedirect: true },
        });
        if (error || !data.url) throw friendly(error ?? new Error('Couldn’t start Google sign-in.'));
        const result = await WebBrowser.openAuthSessionAsync(data.url, AUTH_REDIRECT);
        if (result.type !== 'success') return false;
        // Supabase hands the session back in the link's #fragment (or ?query on some browsers).
        const params = new URLSearchParams(result.url.split('#')[1] ?? result.url.split('?')[1] ?? '');
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');
        if (!access_token || !refresh_token) throw friendly(new Error(params.get('error_description') ?? 'Google sign-in didn’t finish.'));
        const { error: sessionError } = await client.auth.setSession({ access_token, refresh_token });
        if (sessionError) throw friendly(sessionError);
        return true;
      },
      signOut: async () => {
        await need().auth.signOut();
      },
      sendPasswordReset: async (email) => {
        const { error } = await need().auth.resetPasswordForEmail(email.trim());
        if (error) throw friendly(error);
      },
      resetPassword: async (email, code, password) => {
        const client = need();
        const { error } = await client.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'recovery' });
        if (error) throw friendly(new Error(`otp ${error.message}`));
        const { error: updateError } = await client.auth.updateUser({ password });
        if (updateError) throw friendly(updateError);
      },
      deleteAccount: async () => {
        const client = need();
        const { error } = await client.rpc('delete_my_account');
        if (error) throw friendly(error);
        await client.auth.signOut();
      },
    };
  }, [status, session, lastSync, syncError]);

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountValue {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error('useAccount must be used inside AccountProvider');
  return ctx;
}
