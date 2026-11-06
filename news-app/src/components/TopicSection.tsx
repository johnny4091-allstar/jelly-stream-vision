import { openTopic } from '../navigation';
import { getTopic } from '../sources';
import { useStories } from '../state/useStories';
import type { Topic } from '../types';
import { FollowButton, MoreLink, SectionHeader, SkeletonCard } from './common';
import { StoryCard } from './StoryCard';

/** One topic on the Explore and You tabs: title, Follow, a lead story, two more, and a link to the rest. */
export function TopicSection({
  topic,
  count = 3,
  refreshToken = 0,
  hideHeader,
}: {
  topic: Topic;
  count?: number;
  refreshToken?: number;
  /** The screen shows its own title above it. */
  hideHeader?: boolean;
}) {
  const info = getTopic(topic);
  const { stories, loading } = useStories(topic, refreshToken);
  const shown = stories.slice(0, count);
  return (
    <>
      {hideHeader ? null : <SectionHeader title={info.title} right={<FollowButton topic={topic} />} onPress={() => openTopic(topic)} />}
      {loading && shown.length === 0 ? (
        <>
          <SkeletonCard />
          <SkeletonCard />
        </>
      ) : (
        shown.map((s, i) => <StoryCard key={s.id} story={s} variant={i === 0 ? 'lead' : 'row'} index={i} />)
      )}
      {stories.length > count ? (
        <MoreLink label={`More ${info.id === 'top' ? 'top' : info.title} stories`} onPress={() => openTopic(topic)} />
      ) : null}
    </>
  );
}
