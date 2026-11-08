import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { AppState, Platform } from 'react-native';

// Accounts live in the app owner's Supabase project. The URL and public ("anon") key are baked in
// at build time from the SUPABASE_URL and SUPABASE_ANON_KEY secrets; the public key is meant to
// ship in apps, and row-level security (supabase/schema.sql) keeps each user to their own data.
const extra = (Constants.expoConfig?.extra ?? {}) as { supabaseUrl?: string; supabaseAnonKey?: string; googleSignIn?: boolean };

export const supabase: SupabaseClient | null =
  extra.supabaseUrl && extra.supabaseAnonKey
    ? createClient(extra.supabaseUrl, extra.supabaseAnonKey, {
        auth: {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;

/** False until the build has the Supabase secrets; the app then hides sign-in. */
export const accountsEnabled = supabase !== null;

/** "Continue with Google" shows only once Google is set up in the Supabase project (GOOGLE_SIGN_IN=1). */
export const googleEnabled = accountsEnabled && !!extra.googleSignIn;

/** Where Google sends the user back after signing in (the app's own link scheme, from app.json). */
export const AUTH_REDIRECT = 'newshammer://auth-callback';

// Refresh the session only while the app is on screen.
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
