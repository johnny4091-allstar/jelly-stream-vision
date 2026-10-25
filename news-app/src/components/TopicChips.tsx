import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { TOPICS } from '../sources';
import { useTheme } from '../theme';
import type { Topic } from '../types';

/** Samsung News-style pills: round coloured badge plus label; the active one is solid black. */
export function TopicChips({ value, onChange }: { value: Topic; onChange: (t: Topic) => void }) {
  const c = useTheme();
  return (
    <View style={{ backgroundColor: c.background }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {TOPICS.map((t) => {
          const active = t.id === value;
          return (
            <Pressable
              key={t.id}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                onChange(t.id);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={[styles.chip, { backgroundColor: active ? c.chipActive : c.chip }]}
            >
              <View style={[styles.badge, { backgroundColor: t.color }]}>
                <Ionicons name={t.icon as keyof typeof Ionicons.glyphMap} size={17} color="#fff" />
              </View>
              <Text style={[styles.label, { color: active ? c.chipActiveText : c.chipText }]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 6, paddingRight: 18, paddingVertical: 6, borderRadius: 999 },
  badge: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 17, fontWeight: '600' },
});
