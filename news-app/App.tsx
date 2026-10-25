import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DarkTheme, DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useLastNotificationResponse } from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { UpdatePrompt } from './src/components/UpdatePrompt';
import { navigationRef, openArticle, type RootStackParamList } from './src/navigation';
import { ArticleScreen } from './src/screens/ArticleScreen';
import { setUpNotifications, type NotificationData } from './src/services/notifications';
import { FloatingTabBar } from './src/components/FloatingTabBar';
import { FollowingScreen } from './src/screens/FollowingScreen';
import { ForYouScreen } from './src/screens/ForYouScreen';
import { LiveTvScreen } from './src/screens/LiveTvScreen';
import { NewsScreen } from './src/screens/NewsScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { SportsScreen } from './src/screens/SportsScreen';
import { TopicScreen } from './src/screens/TopicScreen';
import { SavedProvider } from './src/state/SavedContext';
import { SettingsProvider, useSettings } from './src/state/SettingsContext';
import { useTheme } from './src/theme';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator<RootStackParamList>();

// Samsung News-style tabs in a floating bar, plus free live news channels. Settings lives behind the ⋮ in the header.
function Tabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false, animation: 'shift' }} tabBar={(props) => <FloatingTabBar {...props} />}>
      <Tab.Screen name="For you" component={ForYouScreen} />
      <Tab.Screen name="News" component={NewsScreen} />
      <Tab.Screen name="Live TV" component={LiveTvScreen} />
      <Tab.Screen name="Sports" component={SportsScreen} />
      <Tab.Screen name="Following" component={FollowingScreen} />
    </Tab.Navigator>
  );
}

// Notifications don't exist on web (used only for previewing the layout in a browser).
const useNotificationResponse = Platform.OS === 'web' ? () => null : useLastNotificationResponse;

/** Opens the story from a tapped notification, including one that launched the app. */
function useNotificationTaps(navReady: boolean) {
  const response = useNotificationResponse();
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
        <Stack.Screen name="Topic" component={TopicScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ animation: 'slide_from_right' }} />
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
