import { createNavigationContainerRef, type NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { Video } from './media';
import type { Story, Topic } from './types';

export type TabParamList = {
  Today: undefined;
  Explore: undefined;
  Watch: undefined;
  Scores: undefined;
  You: undefined;
};

/** The bottom tabs, in order. */
export const TAB_NAMES: (keyof TabParamList)[] = ['Today', 'Explore', 'Watch', 'Scores', 'You'];

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  Article: { story: Story };
  Topic: { topic: Topic };
  Settings: undefined;
  Watch: { url: string; title: string };
  Weather: undefined;
  Radar: undefined;
  Video: { video: Video };
  Media: { tab: MediaTab };
  QuickRead: undefined;
  /** Weather, top stories, your teams and markets, to read or listen to. */
  Briefing: undefined;
  /** Every outlet's take on one story. */
  Coverage: { story: Story };
  Onboarding: undefined;
  /** `then: 'back'` returns to the screen that opened it (the setup flow) instead of Account. */
  Auth: { mode?: AuthMode; then?: 'back' } | undefined;
  Account: undefined;
};

export type AuthMode = 'signin' | 'signup';

export type MediaTab = 'videos' | 'podcasts';

export type ArticleScreenProps = NativeStackScreenProps<RootStackParamList, 'Article'>;
export type TopicScreenProps = NativeStackScreenProps<RootStackParamList, 'Topic'>;
export type WatchScreenProps = NativeStackScreenProps<RootStackParamList, 'Watch'>;
export type VideoScreenProps = NativeStackScreenProps<RootStackParamList, 'Video'>;
export type MediaScreenProps = NativeStackScreenProps<RootStackParamList, 'Media'>;
export type CoverageScreenProps = NativeStackScreenProps<RootStackParamList, 'Coverage'>;
export type AuthScreenProps = NativeStackScreenProps<RootStackParamList, 'Auth'>;
export type OnboardingScreenProps = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

/** Lets code outside screens (notification taps, cards, headers) navigate. */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function openArticle(story: Story): void {
  if (navigationRef.isReady()) navigationRef.navigate('Article', { story });
}

export function openTopic(topic: Topic): void {
  if (navigationRef.isReady()) navigationRef.navigate('Topic', { topic });
}

/** A web page (e.g. a YouTube live stream) full screen inside the app. */
export function openWatch(url: string, title: string): void {
  if (navigationRef.isReady()) navigationRef.navigate('Watch', { url, title });
}

/** The full forecast for where the phone is. */
export function openWeather(): void {
  if (navigationRef.isReady()) navigationRef.navigate('Weather');
}

/** Live rain radar around the user. */
export function openRadar(): void {
  if (navigationRef.isReady()) navigationRef.navigate('Radar');
}

/** A news video in the app's YouTube player. */
export function openVideo(video: Video): void {
  if (navigationRef.isReady()) navigationRef.navigate('Video', { video });
}

/** All videos or all podcasts. */
export function openMedia(tab: MediaTab): void {
  if (navigationRef.isReady()) navigationRef.navigate('Media', { tab });
}

/** Today's top stories one at a time, full screen. */
export function openQuickRead(): void {
  if (navigationRef.isReady()) navigationRef.navigate('QuickRead');
}

/** The morning briefing. */
export function openBriefing(): void {
  if (navigationRef.isReady()) navigationRef.navigate('Briefing');
}

/** Switches to the Scores tab. */
export function openScores(): void {
  if (navigationRef.isReady()) navigationRef.navigate('Tabs', { screen: 'Scores' });
}

/** Switches to the Watch tab (live TV, videos, podcasts). */
export function openLiveTv(): void {
  if (navigationRef.isReady()) navigationRef.navigate('Tabs', { screen: 'Watch' });
}

export function openExplore(): void {
  if (navigationRef.isReady()) navigationRef.navigate('Tabs', { screen: 'Explore' });
}

/** All outlets covering the same story as this one. */
export function openCoverage(story: Story): void {
  if (navigationRef.isReady()) navigationRef.navigate('Coverage', { story });
}

export function openAuth(mode: AuthMode, then?: 'back'): void {
  if (navigationRef.isReady()) navigationRef.navigate('Auth', { mode, then });
}

export function openAccount(): void {
  if (navigationRef.isReady()) navigationRef.navigate('Account');
}

/** The first-launch setup, again from Settings. */
export function openOnboarding(): void {
  if (navigationRef.isReady()) navigationRef.navigate('Onboarding');
}

export function openSettings(): void {
  if (navigationRef.isReady()) navigationRef.navigate('Settings');
}

export function goBack(): void {
  if (navigationRef.isReady() && navigationRef.canGoBack()) navigationRef.goBack();
}
