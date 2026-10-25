import * as WebBrowser from 'expo-web-browser';
import { Share } from 'react-native';

import type { Story } from '../types';

/** Opens the publisher's page in the in-app browser. The app never shows full article text. */
export function openStory(story: Story, colors: { toolbar: string; controls: string }): void {
  WebBrowser.openBrowserAsync(story.link, {
    toolbarColor: colors.toolbar,
    controlsColor: colors.controls,
    enableBarCollapsing: true,
    showTitle: true,
  }).catch(() => {});
}

export function shareStory(story: Story): void {
  Share.share({ title: story.title, message: `${story.title}\n${story.link}`, url: story.link }).catch(() => {});
}
