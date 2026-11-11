import AsyncStorage from '@react-native-async-storage/async-storage';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DarkTheme, DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useLastNotificationResponse } from 'expo-notifications';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { UpdatePrompt } from './src/components/UpdatePrompt';
import { TAB_NAMES, navigationRef, openArticle, openBriefing, openRecap, openScores, type RootStackParamList, type TabParamList } from './src/navigation';
import { ArticleScreen } from './src/screens/ArticleScreen';
import { setUpNotifications, syncBriefingAlert, syncRecapAlert, type NotificationData } from './src/services/notifications';
import { BackgroundGuide, showBackgroundGuideOnce } from './src/components/BackgroundGuide';
import { FloatingTabBar } from './src/components/FloatingTabBar';
import { BriefingScreen } from './src/screens/BriefingScreen';
import { PulseScreen } from './src/screens/PulseScreen';
import { RecapScreen } from './src/screens/RecapScreen';
import { CoverageScreen } from './src/screens/CoverageScreen';
import { ExploreScreen } from './src/screens/ExploreScreen';
import { ForYouScreen } from './src/screens/ForYouScreen';
import { LiveTvScreen } from './src/screens/LiveTvScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { YouScreen } from './src/screens/YouScreen';
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
import { AccountProvider, useAccount } from './src/state/AccountContext';
import { SavePrompt } from './src/components/AccountPrompts';
import { useGames } from './src/components/Scores';
import { updateLiveScore } from './src/services/liveScore';
import { updateWidgets } from './src/widgets';

/** Keeps the lock-screen score up to date while the app is open (useGames polls every 30 s when live). */
function LiveScoreNotifier() {
  const { favoriteTeams, liveScoreAlert } = useSettings();
  const { games } = useGames();
  useEffect(() => {
    if (games && favoriteTeams.length) updateLiveScore(games, favoriteTeams, liveScoreAlert).catch(() => {});
  }, [games, favoriteTeams, liveScoreAlert]);
  return null;
}
import { useTheme } from './src/theme';
import { CrashGuard } from './src/crashGuard';

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

// Design v2: Today, Explore, Watch, Scores, You. Settings is the gear in each tab's header.
function Tabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false, animation: 'shift' }} tabBar={(props) => <FloatingTabBar {...props} />}>
      <Tab.Screen name="Today" component={ForYouScreen} />
      <Tab.Screen name="Explore" component={ExploreScreen} />
      <Tab.Screen name="Watch" component={LiveTvScreen} />
      <Tab.Screen name="Scores" component={ScoresScreen} />
      <Tab.Screen name="You" component={YouScreen} />
    </Tab.Navigator>
  );
}

// Native builds bundle the fonts (expo-font plugin in app.json); the web preview loads them here.
const WEB_FONTS = {
  BarlowCondensed_700Bold: require('./assets/fonts/BarlowCondensed_700Bold.ttf'),
  BarlowCondensed_800ExtraBold: require('./assets/fonts/BarlowCondensed_800ExtraBold.ttf'),
  BarlowCondensed_900Black: require('./assets/fonts/BarlowCondensed_900Black.ttf'),
};
const useAppFonts = Platform.OS === 'web' ? () => useFonts(WEB_FONTS)[0] : () => true;

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
    else if (data?.kind === 'briefing') openBriefing();
    else if (data?.kind === 'recap') openRecap();
    else if (data?.kind === 'score') openScores();
  }, [navReady, response]);
}

function Root() {
  const c = useTheme();
  const { ready, briefingAlert, recapAlert } = useSettings();
  useEffect(() => {
    if (ready) syncRecapAlert(recapAlert).catch(() => {});
  }, [ready, recapAlert]);
  // Home screen widgets: refresh once the app's data has loaded, and whenever it's put away.
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => updateWidgets().catch(() => {}), 10_000);
    const sub = AppState.addEventListener('change', (s) => s === 'background' && updateWidgets().catch(() => {}));
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, [ready]);
  const account = useAccount();
  // The 7 AM briefing alert: on for everyone without accounts, for signed-in people with them.
  const briefingOn = briefingAlert && (!account.enabled || account.status === 'signedIn');
  useEffect(() => {
    if (ready && account.status !== 'loading') syncBriefingAlert(briefingOn).catch(() => {});
  }, [ready, briefingOn, account.status]);
  const fontsReady = useAppFonts();
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
    // Keeps the background check scheduled for people who allowed notifications. Nobody is asked at
    // launch: new installs are asked in the setup screens, and anyone can turn alerts on in Settings.
    if (ready && firstRoute === 'Tabs')
      setUpNotifications({ ask: false })
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

  if (!firstRoute || !fontsReady) return <View style={{ flex: 1, backgroundColor: c.background }} />;

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
        <Stack.Screen name="Pulse" component={PulseScreen} options={{ animation: 'fade' }} />
        <Stack.Screen name="Recap" component={RecapScreen} options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="Briefing" component={BriefingScreen} options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="Coverage" component={CoverageScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="Auth" component={AuthScreen} options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="Account" component={AccountScreen} options={{ animation: 'slide_from_right' }} />
      </Stack.Navigator>
      {routeName === 'Media' || TAB_NAMES.includes(routeName as keyof TabParamList) ? <MiniPlayer aboveTabs={routeName !== 'Media'} /> : null}
      <ShareSheet />
      <SavePrompt />
      <LiveScoreNotifier />
      <UpdatePrompt />
      <BackgroundGuide />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <CrashGuard>
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
    </CrashGuard>
  );
}
