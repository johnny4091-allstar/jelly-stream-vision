import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FollowButton, StackHeader } from '../components/common';
import { MarketsStrip } from '../components/MarketsStrip';
import { TopicFeed } from '../components/TopicFeed';
import type { TopicScreenProps } from '../navigation';
import { getTopic } from '../sources';
import { useTheme } from '../theme';

/** All stories in one topic, opened from a section's chevron or "More … stories". */
export function TopicScreen({ route }: TopicScreenProps) {
  const { topic } = route.params;
  const c = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <StackHeader title={getTopic(topic).title} right={<FollowButton topic={topic} />} />
      <TopicFeed topic={topic} paddingTop={4} paddingBottom={insets.bottom + 24} header={topic === 'business' ? <MarketsStrip /> : <></>} />
    </View>
  );
}
