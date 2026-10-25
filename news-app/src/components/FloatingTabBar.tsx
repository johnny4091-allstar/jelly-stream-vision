import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme';

const ICONS: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  'For you': ['star', 'star-outline'],
  News: ['newspaper', 'newspaper-outline'],
  'Live TV': ['tv', 'tv-outline'],
  Sports: ['football', 'football-outline'],
  Following: ['notifications', 'notifications-outline'],
};

/** Rounded bar floating above the content, with a pill behind the active tab (Samsung News style). */
export function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  // Fit every tab on narrow phones; cap the width on wide ones.
  const itemWidth = Math.min(80, (useWindowDimensions().width - 44) / state.routes.length);
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + 12 }]}>
      <View style={[styles.bar, { backgroundColor: c.tabBar }]}>
        {state.routes.map((route, i) => {
          const focused = state.index === i;
          const [on, off] = ICONS[route.name] ?? ['ellipse', 'ellipse-outline'];
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!event.defaultPrevented) {
              Haptics.selectionAsync().catch(() => {});
              // Navigating to the focused tab lets screens scroll back to the top (useScrollToTop).
              navigation.navigate(route.name, route.params);
            }
          };
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={route.name}
              style={[styles.item, { width: itemWidth }, focused && { backgroundColor: c.dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }]}
            >
              <Ionicons name={focused ? on : off} size={24} color={c.text} />
              <Text style={[styles.label, { color: c.text, fontWeight: focused ? '800' : '500' }]} numberOfLines={1}>
                {route.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  bar: {
    flexDirection: 'row',
    borderRadius: 40,
    padding: 6,
    gap: 2,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  item: { alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 8, borderRadius: 32 },
  label: { fontSize: 12 },
});
