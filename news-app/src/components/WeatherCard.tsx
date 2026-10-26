import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { openWeather } from '../navigation';
import { RadarPreview } from './RadarPreview';
import { condition, conditionIcon, formatTemp, type HourForecast } from '../services/weather';
import { useSettings } from '../state/SettingsContext';
import { useWeather } from '../state/WeatherContext';
import { useTheme } from '../theme';

/** Sky colours behind the weather: day, night, and grey for cloud, rain and snow. */
export function skyColors(code: number, isDay: boolean): [string, string] {
  if (!isDay) return ['#0E1A3A', '#26345E'];
  if (code >= 45) return ['#4F5D73', '#7A8798'];
  if (code === 3) return ['#5B7194', '#8FA2BD'];
  return ['#2D74D6', '#5FA8F0'];
}

export function hourLabel(h: HourForecast, i: number): string {
  if (i === 0) return 'Now';
  const hour = new Date(h.time).getHours();
  return `${hour % 12 || 12}${hour < 12 ? 'am' : 'pm'}`;
}

type IconName = keyof typeof Ionicons.glyphMap;
export const icon = (name: string) => name as IconName;

/** Current weather where the phone is, near the top of For you. Taps through to the forecast. */
export function WeatherCard() {
  const c = useTheme();
  const { showWeather, setShowWeather, tempUnit } = useSettings();
  const { access, weather, loading, failed, enable, refresh } = useWeather();

  if (!showWeather || (access === 'checking' && !weather)) return null;

  if (!weather) {
    if (access === 'granted') {
      return (
        <Pressable onPress={refresh} style={[styles.prompt, { backgroundColor: c.card }]} accessibilityRole="button">
          {loading ? <ActivityIndicator color={c.tertiary} /> : <Ionicons name="cloud-offline-outline" size={22} color={c.tertiary} />}
          <Text style={[styles.promptText, { color: c.secondary }]}>
            {loading || !failed ? 'Getting your local weather…' : "Couldn't load the weather. Tap to try again."}
          </Text>
        </Pressable>
      );
    }
    return (
      <View style={[styles.ask, { backgroundColor: c.card }]}>
        <View style={styles.askTop}>
          <View style={styles.askIcon}>
            <Ionicons name="partly-sunny" size={26} color="#fff" />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.askTitle, { color: c.text }]}>Local weather</Text>
            <Text style={[styles.promptText, { color: c.secondary }]}>
              {access === 'blocked'
                ? 'Location is off for News Hammer. Allow it in your phone settings to see the weather.'
                : 'Use your location to see the weather where you are.'}
            </Text>
          </View>
        </View>
        <View style={styles.askButtons}>
          <Pressable onPress={() => setShowWeather(false)} style={styles.askSecondary} accessibilityRole="button">
            <Text style={[styles.askSecondaryText, { color: c.secondary }]}>No thanks</Text>
          </Pressable>
          <Pressable onPress={enable} style={[styles.askPrimary, { backgroundColor: c.chipActive }]} accessibilityRole="button">
            <Text style={[styles.askPrimaryText, { color: c.chipActiveText }]}>
              {access === 'blocked' ? 'Open settings' : 'Show weather'}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const now = weather.current;
  const today = weather.daily[0];
  return (
    <Pressable
      onPress={openWeather}
      style={styles.wrap}
      accessibilityRole="button"
      accessibilityLabel={`Weather${weather.place ? ` in ${weather.place}` : ''}: ${formatTemp(now.temp, tempUnit)}, ${condition(now.code).label}`}
    >
      <LinearGradient colors={skyColors(now.code, now.isDay)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
        <View style={styles.top}>
          <Ionicons name={icon(conditionIcon(now.code, now.isDay))} size={44} color="#fff" />
          <Text style={styles.temp}>{formatTemp(now.temp, tempUnit)}</Text>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.label} numberOfLines={1}>
              {condition(now.code).label}
            </Text>
            <Text style={styles.sub} numberOfLines={1}>
              {today ? `H ${formatTemp(today.high, tempUnit)}  L ${formatTemp(today.low, tempUnit)}` : ''}
            </Text>
          </View>
          <View style={styles.place}>
            <Ionicons name="location" size={13} color="rgba(255,255,255,0.85)" />
            <Text style={styles.sub} numberOfLines={1}>
              {weather.place || 'Your location'}
            </Text>
          </View>
        </View>
        <View style={styles.hours}>
          {weather.hourly.slice(0, 6).map((h, i) => (
            <View key={h.time} style={styles.hour}>
              <Text style={styles.hourTime}>{hourLabel(h, i)}</Text>
              <Ionicons name={icon(conditionIcon(h.code, h.isDay))} size={18} color="#fff" />
              <Text style={styles.hourTemp}>{formatTemp(h.temp, tempUnit)}</Text>
            </View>
          ))}
        </View>
        {weather.coords ? <RadarPreview coords={weather.coords} dark={c.dark} /> : null}
      </LinearGradient>
    </Pressable>
  );
}

/** Small "☀ 72°" in the app bar; opens the forecast. */
export function WeatherChip() {
  const c = useTheme();
  const { tempUnit } = useSettings();
  const { weather } = useWeather();
  if (!weather) return null;
  const now = weather.current;
  return (
    <Pressable
      onPress={openWeather}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={`Weather: ${formatTemp(now.temp, tempUnit)}`}
      style={[styles.chip, { backgroundColor: c.card }]}
    >
      <Ionicons name={icon(conditionIcon(now.code, now.isDay))} size={16} color={c.text} />
      <Text style={[styles.chipText, { color: c.text }]}>{formatTemp(now.temp, tempUnit)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 12, marginBottom: 12 },
  card: { borderRadius: 22, padding: 16, gap: 14 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  temp: { color: '#fff', fontSize: 40, fontWeight: '300', letterSpacing: -1 },
  label: { color: '#fff', fontSize: 16, fontWeight: '700' },
  sub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '500' },
  place: { flexDirection: 'row', alignItems: 'center', gap: 3, maxWidth: '34%', alignSelf: 'flex-start' },
  hours: { flexDirection: 'row', justifyContent: 'space-between' },
  hour: { alignItems: 'center', gap: 4 },
  hourTime: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600' },
  hourTemp: { color: '#fff', fontSize: 14, fontWeight: '700' },
  prompt: { marginHorizontal: 12, marginBottom: 12, borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  promptText: { flex: 1, fontSize: 14, lineHeight: 19 },
  ask: { marginHorizontal: 12, marginBottom: 12, borderRadius: 20, padding: 16, gap: 14 },
  askTop: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  askIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#2D74D6', alignItems: 'center', justifyContent: 'center' },
  askTitle: { fontSize: 17, fontWeight: '800' },
  askButtons: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 8 },
  askSecondary: { paddingHorizontal: 14, paddingVertical: 9 },
  askSecondaryText: { fontSize: 15, fontWeight: '600' },
  askPrimary: { borderRadius: 999, paddingHorizontal: 18, paddingVertical: 9 },
  askPrimaryText: { fontSize: 15, fontWeight: '700' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  chipText: { fontSize: 14, fontWeight: '700' },
});
