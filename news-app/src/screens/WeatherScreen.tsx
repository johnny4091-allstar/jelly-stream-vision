import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StackHeader } from '../components/common';
import { hourLabel, icon, skyColors, WeatherCard } from '../components/WeatherCard';
import { condition, conditionIcon, formatTemp, formatWind, type DayForecast } from '../services/weather';
import { useSettings } from '../state/SettingsContext';
import { useWeather } from '../state/WeatherContext';
import { useTheme } from '../theme';
import { timeAgo } from '../utils';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function dayLabel(d: DayForecast, i: number): string {
  if (i === 0) return 'Today';
  const [y, m, day] = d.date.split('-').map(Number);
  return DAYS[new Date(y!, m! - 1, day).getDay()] ?? d.date;
}

/** The full forecast: now, the next 24 hours and the week. */
export function WeatherScreen() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { tempUnit } = useSettings();
  const { weather, loading, refresh } = useWeather();

  const refreshButton = (
    <Pressable onPress={refresh} hitSlop={12} accessibilityRole="button" accessibilityLabel="Refresh weather" style={{ padding: 4 }}>
      <Ionicons name="refresh" size={22} color={c.text} />
    </Pressable>
  );

  if (!weather) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background }}>
        <StackHeader title="Weather" />
        <View style={{ paddingTop: 12 }}>
          <WeatherCard />
        </View>
      </View>
    );
  }

  const now = weather.current;
  const today = weather.daily[0];
  const weekLow = Math.min(...weather.daily.map((d) => d.low));
  const weekHigh = Math.max(...weather.daily.map((d) => d.high));
  const span = Math.max(weekHigh - weekLow, 1);
  const details = [
    { icon: 'thermometer-outline', label: 'Feels like', value: formatTemp(now.feelsLike, tempUnit) },
    { icon: 'water-outline', label: 'Humidity', value: `${Math.round(now.humidity)}%` },
    { icon: 'leaf-outline', label: 'Wind', value: formatWind(now.wind, tempUnit) },
    { icon: 'umbrella-outline', label: 'Rain today', value: `${today?.rainChance ?? 0}%` },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <StackHeader title="Weather" right={refreshButton} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={c.tertiary} />}
      >
        <LinearGradient colors={skyColors(now.code, now.isDay)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <View style={styles.place}>
            <Ionicons name="location" size={16} color="#fff" />
            <Text style={styles.placeText} numberOfLines={1}>
              {weather.place || 'Your location'}
            </Text>
          </View>
          <View style={styles.nowRow}>
            <Ionicons name={icon(conditionIcon(now.code, now.isDay))} size={72} color="#fff" />
            <Text style={styles.bigTemp}>{formatTemp(now.temp, tempUnit)}</Text>
          </View>
          <Text style={styles.condition}>{condition(now.code).label}</Text>
          {today ? (
            <Text style={styles.heroSub}>
              High {formatTemp(today.high, tempUnit)} · Low {formatTemp(today.low, tempUnit)}
            </Text>
          ) : null}
        </LinearGradient>

        <View style={styles.details}>
          {details.map((d) => (
            <View key={d.label} style={[styles.detail, { backgroundColor: c.card }]}>
              <Ionicons name={icon(d.icon)} size={20} color={c.secondary} />
              <Text style={[styles.detailLabel, { color: c.tertiary }]}>{d.label}</Text>
              <Text style={[styles.detailValue, { color: c.text }]}>{d.value}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.heading, { color: c.text }]}>Next 24 hours</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hours}>
          {weather.hourly.map((h, i) => (
            <View key={h.time} style={[styles.hour, { backgroundColor: c.card }]}>
              <Text style={[styles.hourTime, { color: c.tertiary }]}>{hourLabel(h, i)}</Text>
              <Ionicons name={icon(conditionIcon(h.code, h.isDay))} size={24} color={c.text} />
              <Text style={[styles.hourTemp, { color: c.text }]}>{formatTemp(h.temp, tempUnit)}</Text>
              <Text style={[styles.rain, { opacity: h.rainChance >= 20 ? 1 : 0 }]}>{h.rainChance}%</Text>
            </View>
          ))}
        </ScrollView>

        <Text style={[styles.heading, { color: c.text }]}>7-day forecast</Text>
        <View style={[styles.week, { backgroundColor: c.card }]}>
          {weather.daily.map((d, i) => (
            <View key={d.date} style={[styles.day, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.separator }]}>
              <Text style={[styles.dayName, { color: c.text }]}>{dayLabel(d, i)}</Text>
              <View style={styles.dayIcon}>
                <Ionicons name={icon(conditionIcon(d.code))} size={22} color={c.text} />
                {d.rainChance >= 20 ? <Text style={styles.rain}>{d.rainChance}%</Text> : null}
              </View>
              <Text style={[styles.dayTemp, { color: c.tertiary }]}>{formatTemp(d.low, tempUnit)}</Text>
              <View style={[styles.track, { backgroundColor: c.dark ? c.chip : '#E6E6EA' }]}>
                <LinearGradient
                  colors={['#5FA8F0', '#F5A623']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[
                    styles.range,
                    { left: `${((d.low - weekLow) / span) * 100}%`, width: `${Math.max(((d.high - d.low) / span) * 100, 6)}%` },
                  ]}
                />
              </View>
              <Text style={[styles.dayTemp, { color: c.text }]}>{formatTemp(d.high, tempUnit)}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.credit, { color: c.tertiary }]}>
          Updated {timeAgo(weather.fetchedAt).replace('Just now', 'just now') || 'just now'} · Weather data by Open-Meteo.com
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { marginHorizontal: 12, marginTop: 4, borderRadius: 24, padding: 20, alignItems: 'center', gap: 4 },
  place: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  placeText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  nowRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 },
  bigTemp: { color: '#fff', fontSize: 72, fontWeight: '200', letterSpacing: -2 },
  condition: { color: '#fff', fontSize: 20, fontWeight: '700' },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: '500' },
  details: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8, marginTop: 12 },
  detail: { width: '46%', marginHorizontal: '2%', marginBottom: 10, borderRadius: 18, padding: 14, gap: 4 },
  detailLabel: { fontSize: 13, fontWeight: '600' },
  detailValue: { fontSize: 22, fontWeight: '700' },
  heading: { fontSize: 20, fontWeight: '800', marginHorizontal: 18, marginTop: 14, marginBottom: 10 },
  hours: { paddingHorizontal: 12, gap: 8 },
  hour: { width: 64, borderRadius: 16, paddingVertical: 12, alignItems: 'center', gap: 6 },
  hourTime: { fontSize: 13, fontWeight: '600' },
  hourTemp: { fontSize: 16, fontWeight: '700' },
  rain: { color: '#3A8DDE', fontSize: 12, fontWeight: '700' },
  week: { marginHorizontal: 12, borderRadius: 20, paddingHorizontal: 16 },
  day: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  dayName: { width: 52, fontSize: 16, fontWeight: '700' },
  dayIcon: { width: 44, alignItems: 'center' },
  dayTemp: { width: 38, fontSize: 15, fontWeight: '600', textAlign: 'right' },
  track: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  range: { position: 'absolute', top: 0, bottom: 0, borderRadius: 3 },
  credit: { fontSize: 12, textAlign: 'center', marginTop: 16, marginHorizontal: 20 },
});
