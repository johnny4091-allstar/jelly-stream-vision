import { Share } from 'react-native';

import type { Story } from '../types';

export function shareStory(story: Story): void {
  Share.share({ title: story.title, message: `${story.title}\n${story.link}`, url: story.link }).catch(() => {});
}
