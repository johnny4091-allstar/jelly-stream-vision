import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DarkTheme, DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FeedScreen } from './src/screens/FeedScreen';
import { SavedScreen } from './src/screens/SavedScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { TodayScreen } from './src/screens/TodayScreen';
import { SavedProvider } from './src/state/SavedContext';
import { SettingsProvider } from './src/state/SettingsContext';
import { useTheme } from './src/theme';

const Tab = createBottomTabNavigator();

const ICONS: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  Today: ['today', 'today-outline'],
  Feed: ['newspaper', 'newspaper-outline'],
  Saved: ['bookmark', 'bookmark-outline'],
  Settings: ['settings', 'settings-outline'],
};

function Root() {
  const c = useTheme();
  const navTheme = useMemo<Theme>(() => {
    const base = c.dark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: { ...base.colors, primary: c.accent, background: c.background, card: c.card, text: c.text, border: c.separator },
    };
  }, [c]);

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style={c.dark ? 'light' : 'dark'} />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          animation: 'shift',
          tabBarActiveTintColor: c.accent,
          tabBarInactiveTintColor: c.tertiary,
          tabBarStyle: { backgroundColor: c.card, borderTopColor: c.separator },
          tabBarIcon: ({ focused, color, size }) => {
            const [on, off] = ICONS[route.name] ?? ['ellipse', 'ellipse-outline'];
            return <Ionicons name={focused ? on : off} size={size} color={color} />;
          },
        })}
      >
        <Tab.Screen name="Today" component={TodayScreen} />
        <Tab.Screen name="Feed" component={FeedScreen} />
        <Tab.Screen name="Saved" component={SavedScreen} />
        <Tab.Screen name="Settings" component={SettingsScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <SavedProvider>
          <Root />
        </SavedProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}
