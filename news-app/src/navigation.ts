import { createNavigationContainerRef } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { Video } from './media';
import type { Story, Topic } from './types';

export type RootStackParamList = {
  Tabs: undefined;
  Article: { story: Story };
  Topic: { topic: Topic };
  Settings: undefined;
  Watch: { url: string; title: string };
  Weather: undefined;
  Radar: undefined;
  Video: { video: Video };
  Media: { tab: MediaTab };
};

export type MediaTab = 'videos' | 'podcasts';

export type ArticleScreenProps = NativeStackScreenProps<RootStackParamList, 'Article'>;
export type TopicScreenProps = NativeStackScreenProps<RootStackParamList, 'Topic'>;
export type WatchScreenProps = NativeStackScreenProps<RootStackParamList, 'Watch'>;
export type VideoScreenProps = NativeStackScreenProps<RootStackParamList, 'Video'>;
export type MediaScreenProps = NativeStackScreenProps<RootStackParamList, 'Media'>;

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

export function openSettings(): void {
  if (navigationRef.isReady()) navigationRef.navigate('Settings');
}

export function goBack(): void {
  if (navigationRef.isReady() && navigationRef.canGoBack()) navigationRef.goBack();
}
