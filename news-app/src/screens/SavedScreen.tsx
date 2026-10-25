import { useScrollToTop } from '@react-navigation/native';
import { useCallback, useRef } from 'react';
import { Alert, FlatList, Pressable, Text, View, type ListRenderItem } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState, ScreenHeader } from '../components/common';
import { StoryCard } from '../components/StoryCard';
import { useSaved } from '../state/SavedContext';
import { useTheme } from '../theme';
import type { Story } from '../types';

export function SavedScreen() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { saved, clearSaved } = useSaved();
  const listRef = useRef<FlatList<Story>>(null);
  useScrollToTop(listRef);

  const renderItem = useCallback<ListRenderItem<Story>>(
    ({ item, index }) => <StoryCard story={item} variant="compact" index={index} />,
    [],
  );

  const confirmClear = () =>
    Alert.alert('Clear saved stories?', 'This removes every story from Saved.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: clearSaved },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <FlatList
        ref={listRef}
        data={saved}
        keyExtractor={(s) => s.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 24 }}
        ListHeaderComponent={
          <ScreenHeader
            title="Saved"
            right={
              saved.length > 0 ? (
                <Pressable onPress={confirmClear} hitSlop={10} accessibilityRole="button">
                  <Text style={{ color: c.accent, fontSize: 16, fontWeight: '600', paddingBottom: 6 }}>Clear</Text>
                </Pressable>
              ) : null
            }
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="bookmark-outline"
            title="Nothing saved yet"
            message="Tap the bookmark on any story to keep it here for later. Saved stories stay on this phone."
          />
        }
      />
    </View>
  );
}
