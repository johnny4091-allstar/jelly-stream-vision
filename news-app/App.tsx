import AsyncStorage from '@react-native-async-storage/async-storage';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DarkTheme, DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useLastNotificationResponse } from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { UpdatePrompt } from './src/components/UpdatePrompt';
import { navigationRef, openArticle, type RootStackParamList } from './src/navigation';
import { ArticleScreen } from './src/screens/ArticleScreen';
import { setUpNotifications, type NotificationData } from './src/services/notifications';
import { BackgroundGuide, showBackgroundGuideOnce } from './src/components/BackgroundGuide';
import { FloatingTabBar } from './src/components/FloatingTabBar';
import { FollowingScreen } from './src/screens/FollowingScreen';
import { ForYouScreen } from './src/screens/ForYouScreen';
import { LiveTvScreen } from './src/screens/LiveTvScreen';
import { NewsScreen } from './src/screens/NewsScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { SportsScreen } from './src/screens/SportsScreen';
import { TopicScreen } from './src/screens/TopicScreen';
import { WatchScreen } from './src/screens/WatchScreen';
import { RadarScreen } from './src/screens/RadarScreen';
import { WeatherScreen } from './src/screens/WeatherScreen';
import { SavedProvider } from './src/state/SavedContext';
import { SETTINGS_KEY, SettingsProvider, useSettings } from './src/state/SettingsContext';
import { WeatherProvider } from './src/state/WeatherContext';
import { AudioProvider } from './src/state/AudioContext';
import { MiniPlayer } from './src/components/Media';
import { ShareSheet } from './src/components/ShareSheet';
import { MediaScreen } from './src/screens/MediaScreen';
import { VideoScreen } from './src/screens/VideoScreen';
import { QuickReadScreen } from './src/screens/QuickReadScreen';
import { ScoresScreen } from './src/screens/ScoresScreen';
import { AccountScreen } from './src/screens/AccountScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { ONBOARDING_KEY, OnboardingScreen } from './src/screens/OnboardingScreen';
import { AccountProvider } from './src/state/AccountContext';
import { useTheme } from './src/theme';

const Tab = createBottomTabNavigator();
const TAB_NAMES = ['For you', 'News', 'Live TV', 'Sports', 'Following'];
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
  // The mini player shows on the tabs and the media screen, and sits above the tab bar on the tabs.
  const [routeName, setRouteName] = useState<string | undefined>();
  useNotificationTaps(navReady);
  // New installs start with the setup screens; people updating from an older version don't.
  const [firstRoute, setFirstRoute] = useState<'Tabs' | 'Onboarding' | null>(null);

  useEffect(() => {
    (async () => {
      const [done, settings] = await Promise.all([
        AsyncStorage.getItem(ONBOARDING_KEY).catch(() => null),
        AsyncStorage.getItem(SETTINGS_KEY).catch(() => null),
      ]);
      if (done || settings) {
        if (!done) AsyncStorage.setItem(ONBOARDING_KEY, '1').catch(() => {});
        setFirstRoute('Tabs');
      } else setFirstRoute('Onboarding');
    })();
  }, []);

  useEffect(() => {
    // Keeps the background check scheduled and, for people past setup, asks for notification
    // permission if it was never answered. New installs are asked in the setup screens instead.
    if (ready && firstRoute === 'Tabs')
      setUpNotifications()
        .then((granted) => (granted ? showBackgroundGuideOnce() : undefined))
        .catch(() => {});
  }, [ready, firstRoute]);

  const navTheme = useMemo<Theme>(() => {
    const base = c.dark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: { ...base.colors, primary: c.accent, background: c.background, card: c.card, text: c.text, border: c.separator },
    };
  }, [c]);

  if (!firstRoute) return <View style={{ flex: 1, backgroundColor: c.background }} />;

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navTheme}
      onReady={() => {
        setNavReady(true);
        setRouteName(navigationRef.getCurrentRoute()?.name);
      }}
      onStateChange={() => setRouteName(navigationRef.getCurrentRoute()?.name)}
    >
      <StatusBar style={c.dark ? 'light' : 'dark'} />
      <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={firstRoute}>
        <Stack.Screen name="Tabs" component={Tabs} />
        <Stack.Screen name="Article" component={ArticleScreen} options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="Topic" component={TopicScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="Watch" component={WatchScreen} options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="Weather" component={WeatherScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="Radar" component={RadarScreen} options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="Video" component={VideoScreen} options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="Media" component={MediaScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="QuickRead" component={QuickReadScreen} options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="Scores" component={ScoresScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="Auth" component={AuthScreen} options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="Account" component={AccountScreen} options={{ animation: 'slide_from_right' }} />
      </Stack.Navigator>
      {routeName === 'Media' || TAB_NAMES.includes(routeName ?? '') ? <MiniPlayer aboveTabs={routeName !== 'Media'} /> : null}
      <ShareSheet />
      <UpdatePrompt />
      <BackgroundGuide />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <SavedProvider>
          <WeatherProvider>
            <AudioProvider>
              <AccountProvider>
                <Root />
              </AccountProvider>
            </AudioProvider>
          </WeatherProvider>
        </SavedProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}
