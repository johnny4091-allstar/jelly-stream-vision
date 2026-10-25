import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader, FollowButton, SectionHeader, useTabBarSpace } from '../components/common';
import { TopicFeed } from '../components/TopicFeed';

export function SportsScreen() {
  const insets = useSafeAreaInsets();
  const bottom = useTabBarSpace();
  return (
    <TopicFeed
      topic="sports"
      paddingTop={insets.top}
      paddingBottom={bottom}
      header={
        <>
          <AppHeader />
          <SectionHeader title="Sports" subtitle="Latest from ESPN and your other sources" right={<FollowButton topic="sports" />} />
        </>
      }
    />
  );
}
