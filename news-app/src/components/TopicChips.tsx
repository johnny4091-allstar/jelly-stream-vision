import * as Haptics from 'expo-haptics';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { TOPICS } from '../sources';
import { useTheme } from '../theme';
import type { Topic } from '../types';

export function TopicChips({ value, onChange }: { value: Topic; onChange: (t: Topic) => void }) {
  const c = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {TOPICS.map((t) => {
        const active = t.id === value;
        return (
          <Pressable
            key={t.id}
            onPress={() => {
              if (active) return;
              Haptics.selectionAsync().catch(() => {});
              onChange(t.id);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.chip, { backgroundColor: active ? c.text : c.chip }]}
          >
            <Text style={[styles.label, { color: active ? c.background : c.chipText }]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999 },
  label: { fontSize: 15, fontWeight: '600' },
});
