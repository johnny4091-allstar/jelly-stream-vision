import { createNavigationContainerRef } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { Story } from './types';

export type RootStackParamList = {
  Tabs: undefined;
  Article: { story: Story };
};

export type ArticleScreenProps = NativeStackScreenProps<RootStackParamList, 'Article'>;

/** Lets code outside screens (notification taps) open a story. */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function openArticle(story: Story): void {
  if (navigationRef.isReady()) navigationRef.navigate('Article', { story });
}
