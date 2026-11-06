import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { openWatch } from '../navigation';
import { fetchQuotes, formatChange, formatPrice, quoteUrl, type Quote } from '../services/markets';
import { useTheme } from '../theme';

const REFRESH_MS = 60_000;

let lastQuotes: Quote[] = [];

/** Quotes that refresh every minute while the app is open; the last ones show straight away. */
export function useQuotes(): { quotes: Quote[]; failed: boolean } {
  const [quotes, setQuotes] = useState<Quote[]>(lastQuotes);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (AppState.currentState !== 'active') return;
      const q = await fetchQuotes().catch(() => []);
      if (cancelled) return;
      if (q.length > 0) {
        lastQuotes = q;
        setQuotes(q);
        setFailed(false);
      } else if (lastQuotes.length === 0) {
        setFailed(true);
      }
    };
    load();
    const timer = setInterval(load, REFRESH_MS);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && load());
    return () => {
      cancelled = true;
      clearInterval(timer);
      sub.remove();
    };
  }, []);
  return { quotes, failed };
}

/** Today's prices as a row of thin bars: a chart without a chart library. */
function Sparkline({ points, color }: { points: number[]; color: string }) {
  if (points.length < 2) return <View style={styles.spark} />;
  const step = Math.max(1, Math.floor(points.length / 28));
  const sampled = points.filter((_, i) => i % step === 0);
  const min = Math.min(...sampled);
  const max = Math.max(...sampled);
  const range = max - min || 1;
  return (
    <View style={styles.spark}>
      {sampled.map((p, i) => (
        <View key={i} style={[styles.bar, { height: 3 + ((p - min) / range) * 25, backgroundColor: color }]} />
      ))}
    </View>
  );
}

function QuoteCard({ q }: { q: Quote }) {
  const c = useTheme();
  const color = q.change > 0 ? c.up : q.change < 0 ? c.down : c.tertiary;
  return (
    <Pressable
      onPress={() => openWatch(quoteUrl(q.symbol), q.name)}
      style={[styles.card, { backgroundColor: c.card }]}
      accessibilityRole="button"
      accessibilityLabel={`${q.name} ${formatPrice(q)}, ${formatChange(q)}`}
    >
      <Text style={[styles.name, { color: c.secondary }]} numberOfLines={1}>
        {q.name}
      </Text>
      <Text style={[styles.price, { color: c.text }]} numberOfLines={1}>
        {formatPrice(q)}
      </Text>
      <View style={styles.changeRow}>
        <Ionicons name={q.change >= 0 ? 'caret-up' : 'caret-down'} size={12} color={color} />
        <Text style={[styles.change, { color }]}>{formatChange(q)}</Text>
      </View>
      <Sparkline points={q.points} color={color} />
    </Pressable>
  );
}

/** "Markets": the major indexes, Bitcoin, gold, oil and the 10-year yield, side by side. */
export function MarketsStrip() {
  const c = useTheme();
  const { quotes, failed } = useQuotes();
  if (quotes.length === 0 && !failed) return null;
  const open = quotes.some((q) => q.open && q.kind === 'index');
  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: c.text }]}>Markets</Text>
        {quotes.length > 0 ? (
          <View style={[styles.status, { backgroundColor: open ? 'rgba(18,161,80,0.14)' : c.card }]}>
            <View style={[styles.dot, { backgroundColor: open ? c.up : c.tertiary }]} />
            <Text style={[styles.statusText, { color: open ? c.up : c.secondary }]}>{open ? 'Open' : 'Closed'}</Text>
          </View>
        ) : null}
      </View>
      {failed ? (
        <Text style={[styles.failed, { color: c.secondary }]}>Couldn't load market prices. They'll retry in a minute.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {quotes.map((q) => (
            <QuoteCard key={q.symbol} q={q} />
          ))}
        </ScrollView>
      )}
      <Text style={[styles.note, { color: c.tertiary }]}>Prices from Yahoo Finance and CNBC; may be delayed. Tap for details.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, marginBottom: 8 },
  title: { fontSize: 20, fontWeight: '800' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '700' },
  row: { paddingHorizontal: 12, gap: 8 },
  card: { width: 138, borderRadius: 18, padding: 12, gap: 3 },
  name: { fontSize: 13, fontWeight: '700' },
  price: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  changeRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  change: { fontSize: 13, fontWeight: '700' },
  spark: { height: 28, flexDirection: 'row', alignItems: 'flex-end', gap: 1, marginTop: 6 },
  bar: { flex: 1, borderRadius: 1, opacity: 0.85 },
  failed: { paddingHorizontal: 18, fontSize: 14 },
  note: { fontSize: 11, paddingHorizontal: 18, marginTop: 6 },
});
