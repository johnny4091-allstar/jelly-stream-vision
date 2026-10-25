import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { loadTopic } from '../services/news';
import type { SourceId, Story, Topic } from '../types';
import { useSettings } from './SettingsContext';

interface StoriesState {
  stories: Story[];
  failed: SourceId[];
  /** First load with nothing to show yet. */
  loading: boolean;
  /** Pull-to-refresh in progress. */
  refreshing: boolean;
  refresh: () => void;
}

/**
 * Stories for one topic from the enabled sources. Loads on mount, whenever the topic or sources
 * change, and when the app comes back to the foreground (the 10-minute cache decides whether that
 * hits the network). Pull-to-refresh always goes to the network.
 */
export function useStories(topic: Topic): StoriesState {
  const { enabledSources, ready } = useSettings();
  const [stories, setStories] = useState<Story[]>([]);
  const [failed, setFailed] = useState<SourceId[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const request = useRef(0);
  const sourcesKey = enabledSources.join(',');

  const load = useCallback(
    async (force: boolean) => {
      const id = ++request.current;
      try {
        const result = await loadTopic(topic, sourcesKey ? (sourcesKey.split(',') as SourceId[]) : [], force);
        // Ignore answers to requests that a newer topic/source change superseded.
        if (id !== request.current) return;
        setStories(result.stories);
        setFailed(result.failed);
      } finally {
        if (id === request.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [topic, sourcesKey],
  );

  useEffect(() => {
    if (!ready) return;
    setLoading(true);
    load(false);
  }, [load, ready]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && ready) load(false);
    });
    return () => sub.remove();
  }, [load, ready]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    load(true);
  }, [load]);

  return { stories, failed, loading, refreshing, refresh };
}
