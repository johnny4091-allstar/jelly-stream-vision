import * as Updates from 'expo-updates';
import { useEffect, useRef } from 'react';
import { Alert, AppState } from 'react-native';

const CHECK_INTERVAL_MS = 30 * 60 * 1000;

/**
 * Looks for a new over-the-air update when the app opens and when it returns to the foreground
 * (at most every 30 minutes). A new update is downloaded first, then the user is asked to restart
 * into it now or later. "Later" is safe: the downloaded update starts on the next cold launch.
 *
 * Does nothing in Expo Go or dev builds, where expo-updates is disabled.
 */
export function useUpdatePrompt(): void {
  const lastCheck = useRef(0);
  const busy = useRef(false);
  const prompted = useRef(false);

  useEffect(() => {
    if (!Updates.isEnabled || __DEV__) return;

    const check = async () => {
      if (busy.current || prompted.current || Date.now() - lastCheck.current < CHECK_INTERVAL_MS) return;
      busy.current = true;
      lastCheck.current = Date.now();
      try {
        const { isAvailable } = await Updates.checkForUpdateAsync();
        if (!isAvailable) return;
        const { isNew } = await Updates.fetchUpdateAsync();
        if (!isNew) return;
        prompted.current = true;
        Alert.alert(
          'Update available',
          'A new version of Headlines is ready.',
          [
            { text: 'Later', style: 'cancel' },
            { text: 'Update now', onPress: () => Updates.reloadAsync().catch(() => {}) },
          ],
          { cancelable: true },
        );
      } catch {
        // Offline or the update server is unreachable; try again next time.
      } finally {
        busy.current = false;
      }
    };

    check();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => sub.remove();
  }, []);
}
