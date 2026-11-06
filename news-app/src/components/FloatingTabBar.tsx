import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme';

const ICONS: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  Today: ['grid', 'grid-outline'],
  Explore: ['compass', 'compass-outline'],
  Watch: ['play-circle', 'play-circle-outline'],
  Scores: ['trophy', 'trophy-outline'],
  You: ['person-circle', 'person-circle-outline'],
};

/** Height of the bar above the phone's own navigation area. */
export const TAB_BAR_HEIGHT = 64;

/** Full-width bottom bar: the active tab's icon turns Hammer orange. */
export function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { backgroundColor: c.tabBar, borderTopColor: c.border, paddingBottom: insets.bottom }]}>
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
            style={styles.item}
          >
            <View style={[styles.indicator, { backgroundColor: focused ? c.accent : 'transparent' }]} />
            <Ionicons name={focused ? on : off} size={24} color={focused ? c.accent : c.tertiary} />
            <Text style={[styles.label, { color: focused ? c.text : c.tertiary, fontWeight: focused ? '800' : '600' }]} numberOfLines={1}>
              {route.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth },
  item: { flex: 1, height: TAB_BAR_HEIGHT, alignItems: 'center', justifyContent: 'center', gap: 3 },
  indicator: { position: 'absolute', top: 0, width: 28, height: 3, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 },
  label: { fontSize: 11.5 },
});
