import { createNavigationContainerRef } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { Story, Topic } from './types';

export type RootStackParamList = {
  Tabs: undefined;
  Article: { story: Story };
  Topic: { topic: Topic };
  Settings: undefined;
};

export type ArticleScreenProps = NativeStackScreenProps<RootStackParamList, 'Article'>;
export type TopicScreenProps = NativeStackScreenProps<RootStackParamList, 'Topic'>;

/** Lets code outside screens (notification taps, cards, headers) navigate. */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function openArticle(story: Story): void {
  if (navigationRef.isReady()) navigationRef.navigate('Article', { story });
}

export function openTopic(topic: Topic): void {
  if (navigationRef.isReady()) navigationRef.navigate('Topic', { topic });
}

export function openSettings(): void {
  if (navigationRef.isReady()) navigationRef.navigate('Settings');
}

export function goBack(): void {
  if (navigationRef.isReady() && navigationRef.canGoBack()) navigationRef.goBack();
}
