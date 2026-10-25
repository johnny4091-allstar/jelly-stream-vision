import type { Source, SourceId, Topic } from './types';

export const SOURCES: Source[] = [
  {
    id: 'cnn',
    name: 'CNN',
    color: '#CC0000',
    feeds: {
      top: 'http://rss.cnn.com/rss/cnn_topstories.rss',
      world: 'http://rss.cnn.com/rss/cnn_world.rss',
      sports: 'http://rss.cnn.com/rss/edition_sport.rss',
      tech: 'http://rss.cnn.com/rss/cnn_tech.rss',
      entertainment: 'http://rss.cnn.com/rss/cnn_showbiz.rss',
    },
  },
  {
    id: 'bbc',
    name: 'BBC News',
    color: '#BB1919',
    feeds: {
      top: 'https://feeds.bbci.co.uk/news/rss.xml',
      world: 'https://feeds.bbci.co.uk/news/world/rss.xml',
      sports: 'https://feeds.bbci.co.uk/sport/rss.xml',
      tech: 'https://feeds.bbci.co.uk/news/technology/rss.xml',
      entertainment: 'https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml',
    },
  },
  {
    id: 'npr',
    name: 'NPR',
    color: '#3466B0',
    feeds: {
      top: 'https://feeds.npr.org/1001/rss.xml',
      world: 'https://feeds.npr.org/1004/rss.xml',
      sports: 'https://feeds.npr.org/1055/rss.xml',
      tech: 'https://feeds.npr.org/1019/rss.xml',
      entertainment: 'https://feeds.npr.org/1008/rss.xml',
    },
  },
];

export const SOURCE_IDS = SOURCES.map((s) => s.id);

export function getSource(id: SourceId): Source | undefined {
  return SOURCES.find((s) => s.id === id);
}

export const TOPICS: { id: Topic; label: string }[] = [
  { id: 'top', label: 'Top' },
  { id: 'world', label: 'World' },
  { id: 'sports', label: 'Sports' },
  { id: 'tech', label: 'Tech' },
  { id: 'entertainment', label: 'Entertainment' },
];
