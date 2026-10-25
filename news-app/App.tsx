import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DarkTheme, DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useLastNotificationResponse } from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { UpdatePrompt } from './src/components/UpdatePrompt';
import { navigationRef, openArticle, type RootStackParamList } from './src/navigation';
import { ArticleScreen } from './src/screens/ArticleScreen';
import { setUpNotifications, type NotificationData } from './src/services/notifications';
import { FeedScreen } from './src/screens/FeedScreen';
import { SavedScreen } from './src/screens/SavedScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { TodayScreen } from './src/screens/TodayScreen';
import { SavedProvider } from './src/state/SavedContext';
import { SettingsProvider, useSettings } from './src/state/SettingsContext';
import { useTheme } from './src/theme';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator<RootStackParamList>();

const ICONS: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  Today: ['today', 'today-outline'],
  Feed: ['newspaper', 'newspaper-outline'],
  Saved: ['bookmark', 'bookmark-outline'],
  Settings: ['settings', 'settings-outline'],
};

function Tabs() {
  const c = useTheme();
  return (
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
  );
}

/** Opens the story from a tapped notification, including one that launched the app. */
function useNotificationTaps(navReady: boolean) {
  const response = useLastNotificationResponse();
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (!navReady || !response) return;
    const id = response.notification.request.identifier;
    if (handled.current === id) return;
    handled.current = id;
    const data = response.notification.request.content.data as NotificationData | undefined;
    if (data?.kind === 'story' && data.story?.link) openArticle(data.story);
  }, [navReady, response]);
}

function Root() {
  const c = useTheme();
  const { ready } = useSettings();
  const [navReady, setNavReady] = useState(false);
  useNotificationTaps(navReady);

  useEffect(() => {
    // Asks for notification permission on first launch and keeps the background check scheduled.
    if (ready) setUpNotifications().catch(() => {});
  }, [ready]);

  const navTheme = useMemo<Theme>(() => {
    const base = c.dark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: { ...base.colors, primary: c.accent, background: c.background, card: c.card, text: c.text, border: c.separator },
    };
  }, [c]);

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme} onReady={() => setNavReady(true)}>
      <StatusBar style={c.dark ? 'light' : 'dark'} />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Tabs" component={Tabs} />
        <Stack.Screen name="Article" component={ArticleScreen} options={{ animation: 'slide_from_bottom' }} />
      </Stack.Navigator>
      <UpdatePrompt />
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
