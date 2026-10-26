import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { StackHeader } from '../components/common';
import { useRadarFrames } from '../components/RadarPreview';
import { radarHtml } from '../services/radar';
import type { Coords } from '../services/weather';
import { useWeather } from '../state/WeatherContext';
import { useTheme } from '../theme';

/** Middle of the US, for a forecast cached before the radar knew where it was. */
const FALLBACK: Coords = { latitude: 39.5, longitude: -98.35 };

export function RadarScreen() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { weather } = useWeather();
  const { frames, failed } = useRadarFrames();
  const coords = weather?.coords;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <StackHeader title={weather?.place ? `Radar · ${weather.place}` : 'Radar'} />
      <View style={{ flex: 1, paddingBottom: insets.bottom }}>
        {frames ? (
          <WebView<object>
            source={{ html: radarHtml(frames, coords ?? FALLBACK, !!coords, c.dark), baseUrl: 'https://newshammer.app' }}
            style={{ flex: 1, backgroundColor: c.background }}
            originWhitelist={['*']}
            setSupportMultipleWindows={false}
            // Attribution links stay out of the radar view.
            onShouldStartLoadWithRequest={(req) => req.url.startsWith('https://newshammer.app') || req.url === 'about:blank'}
          />
        ) : (
          <View style={styles.center}>
            {failed ? null : <ActivityIndicator color={c.tertiary} />}
            <Text style={{ color: c.secondary }}>{failed ? "Couldn't load the radar. Check your connection and try again." : 'Loading radar…'}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
});
