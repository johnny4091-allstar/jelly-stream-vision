import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { Story } from '../types';
import { loadJSON, saveJSON } from './storage';

interface SavedValue {
  saved: Story[];
  isSaved: (id: string) => boolean;
  toggleSaved: (story: Story) => void;
  clearSaved: () => void;
}

const KEY = 'saved:v1';

const SavedContext = createContext<SavedValue | null>(null);

export function SavedProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<Story[]>([]);

  useEffect(() => {
    loadJSON<Story[]>(KEY, []).then(setSaved);
  }, []);

  const update = useCallback((fn: (s: Story[]) => Story[]) => {
    setSaved((prev) => {
      const next = fn(prev);
      saveJSON(KEY, next);
      return next;
    });
  }, []);

  const value = useMemo<SavedValue>(() => {
    const ids = new Set(saved.map((s) => s.id));
    return {
      saved,
      isSaved: (id) => ids.has(id),
      // Newest saves first. Only the RSS fields are stored, never article text.
      toggleSaved: (story) =>
        update((s) => (s.some((x) => x.id === story.id) ? s.filter((x) => x.id !== story.id) : [story, ...s])),
      clearSaved: () => update(() => []),
    };
  }, [saved, update]);

  return <SavedContext.Provider value={value}>{children}</SavedContext.Provider>;
}

export function useSaved(): SavedValue {
  const ctx = useContext(SavedContext);
  if (!ctx) throw new Error('useSaved must be used inside SavedProvider');
  return ctx;
}
