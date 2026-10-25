export type Topic = 'top' | 'world' | 'sports' | 'tech' | 'entertainment';

export type SourceId = 'cnn' | 'bbc' | 'npr' | 'ap' | 'fox' | 'verge' | 'espn';

export interface Story {
  /** Stable id (the article link). */
  id: string;
  title: string;
  link: string;
  summary: string;
  imageUrl?: string;
  /** Milliseconds since epoch; 0 when the feed gave no usable date. */
  publishedAt: number;
  sourceId: SourceId;
  sourceName: string;
}

export interface Source {
  id: SourceId;
  name: string;
  /** Brand accent used for the source label on cards. */
  color: string;
  /** Text some feeds append to every headline (e.g. " - AP News"), removed for display. */
  titleSuffix?: string;
  /** One feed URL per topic the outlet covers. `top` is the outlet's main feed. */
  feeds: Partial<Record<Topic, string>>;
}
