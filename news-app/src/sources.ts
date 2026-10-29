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
  {
    // AP doesn't publish RSS, so its stories come via Google News' public RSS search, limited to apnews.com.
    id: 'ap',
    name: 'AP',
    color: '#E4002B',
    titleSuffix: ' - AP News',
    feeds: {
      top: googleNews('site:apnews.com when:1d'),
      world: googleNews('site:apnews.com world when:1d'),
      sports: googleNews('site:apnews.com sports when:1d'),
      tech: googleNews('site:apnews.com technology when:2d'),
      entertainment: googleNews('site:apnews.com entertainment when:2d'),
    },
  },
  {
    id: 'fox',
    name: 'Fox News',
    color: '#003366',
    feeds: {
      top: 'https://moxie.foxnews.com/google-publisher/latest.xml',
      world: 'https://moxie.foxnews.com/google-publisher/world.xml',
      sports: 'https://moxie.foxnews.com/google-publisher/sports.xml',
      tech: 'https://moxie.foxnews.com/google-publisher/tech.xml',
    },
  },
  {
    id: 'verge',
    name: 'The Verge',
    color: '#5200FF',
    feeds: {
      top: 'https://www.theverge.com/rss/index.xml',
      tech: 'https://www.theverge.com/rss/tech/index.xml',
      entertainment: 'https://www.theverge.com/rss/entertainment/index.xml',
    },
  },
  {
    id: 'espn',
    name: 'ESPN',
    color: '#D00000',
    feeds: {
      top: 'https://www.espn.com/espn/rss/news',
      sports: 'https://www.espn.com/espn/rss/news',
    },
  },
  {
    id: 'nyt',
    name: 'The New York Times',
    color: '#121212',
    feeds: {
      top: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml',
      world: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
      tech: 'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml',
      entertainment: 'https://rss.nytimes.com/services/xml/rss/nyt/Arts.xml',
    },
  },
  {
    id: 'guardian',
    name: 'The Guardian',
    color: '#052962',
    feeds: {
      top: 'https://www.theguardian.com/us-news/rss',
      world: 'https://www.theguardian.com/world/rss',
      sports: 'https://www.theguardian.com/us/sport/rss',
      tech: 'https://www.theguardian.com/us/technology/rss',
      entertainment: 'https://www.theguardian.com/us/culture/rss',
    },
  },
  {
    // Like AP, Reuters has no public RSS, so it comes via Google News limited to reuters.com.
    id: 'reuters',
    name: 'Reuters',
    color: '#FF8000',
    titleSuffix: ' - Reuters',
    feeds: {
      top: googleNews('site:reuters.com when:1d'),
      world: googleNews('site:reuters.com world when:1d'),
      sports: googleNews('site:reuters.com sports when:2d'),
      tech: googleNews('site:reuters.com technology when:2d'),
      entertainment: googleNews('site:reuters.com lifestyle when:2d'),
    },
  },
  {
    id: 'abc',
    name: 'ABC News',
    color: '#003DA5',
    feeds: {
      top: 'https://abcnews.go.com/abcnews/topstories',
      world: 'https://abcnews.go.com/abcnews/internationalheadlines',
      sports: 'https://abcnews.go.com/abcnews/sportsheadlines',
      tech: 'https://abcnews.go.com/abcnews/technologyheadlines',
      entertainment: 'https://abcnews.go.com/abcnews/entertainmentheadlines',
    },
  },
  {
    id: 'cbs',
    name: 'CBS News',
    color: '#00539B',
    feeds: {
      top: 'https://www.cbsnews.com/latest/rss/main',
      world: 'https://www.cbsnews.com/latest/rss/world',
      tech: 'https://www.cbsnews.com/latest/rss/technology',
      entertainment: 'https://www.cbsnews.com/latest/rss/entertainment',
    },
  },
  {
    id: 'nbc',
    name: 'NBC News',
    color: '#5C2D91',
    feeds: {
      top: 'https://feeds.nbcnews.com/nbcnews/public/news',
      world: 'https://feeds.nbcnews.com/nbcnews/public/world',
      tech: 'https://feeds.nbcnews.com/nbcnews/public/tech',
      entertainment: 'https://feeds.nbcnews.com/nbcnews/public/pop-culture',
    },
  },
  {
    id: 'aljazeera',
    name: 'Al Jazeera',
    color: '#C78100',
    feeds: {
      top: 'https://www.aljazeera.com/xml/rss/all.xml',
      world: 'https://www.aljazeera.com/xml/rss/all.xml',
    },
  },
  {
    id: 'sky',
    name: 'Sky News',
    color: '#C8102E',
    feeds: {
      top: 'https://feeds.skynews.com/feeds/rss/home.xml',
      world: 'https://feeds.skynews.com/feeds/rss/world.xml',
      tech: 'https://feeds.skynews.com/feeds/rss/technology.xml',
      entertainment: 'https://feeds.skynews.com/feeds/rss/entertainment.xml',
    },
  },
  {
    id: 'techcrunch',
    name: 'TechCrunch',
    color: '#0A9E01',
    feeds: {
      tech: 'https://techcrunch.com/feed/',
    },
  },
  {
    id: 'ars',
    name: 'Ars Technica',
    color: '#FF4E00',
    feeds: {
      tech: 'https://feeds.arstechnica.com/arstechnica/index',
    },
  },
  {
    id: 'variety',
    name: 'Variety',
    color: '#B8312F',
    feeds: {
      entertainment: 'https://variety.com/feed/',
    },
  },
  {
    id: 'cbssports',
    name: 'CBS Sports',
    color: '#0F3A6E',
    feeds: {
      sports: 'https://www.cbssports.com/rss/headlines/',
    },
  },
  {
    id: 'pbs',
    name: 'PBS News',
    color: '#2638C4',
    feeds: {
      top: 'https://www.pbs.org/newshour/feeds/rss/headlines',
      world: 'https://www.pbs.org/newshour/feeds/rss/world',
      entertainment: 'https://www.pbs.org/newshour/feeds/rss/arts',
    },
  },
  {
    id: 'cnbc',
    name: 'CNBC',
    color: '#005594',
    feeds: {
      top: 'https://www.cnbc.com/id/100003114/device/rss/rss.html',
      world: 'https://www.cnbc.com/id/100727362/device/rss/rss.html',
      tech: 'https://www.cnbc.com/id/19854910/device/rss/rss.html',
    },
  },
  {
    id: 'politico',
    name: 'Politico',
    color: '#B4171E',
    feeds: {
      top: 'https://rss.politico.com/politics-news.xml',
    },
  },
  {
    id: 'thehill',
    name: 'The Hill',
    color: '#00529B',
    feeds: {
      top: 'https://thehill.com/news/feed/',
      tech: 'https://thehill.com/policy/technology/feed/',
    },
  },
  {
    id: 'axios',
    name: 'Axios',
    color: '#1E5AE8',
    feeds: {
      top: 'https://api.axios.com/feed/',
    },
  },
  {
    id: 'latimes',
    name: 'Los Angeles Times',
    color: '#1A1A1A',
    feeds: {
      top: 'https://www.latimes.com/world-nation/rss2.0.xml',
      world: 'https://www.latimes.com/world-nation/rss2.0.xml',
      sports: 'https://www.latimes.com/sports/rss2.0.xml',
      tech: 'https://www.latimes.com/business/technology/rss2.0.xml',
      entertainment: 'https://www.latimes.com/entertainment-arts/rss2.0.xml',
    },
  },
  {
    id: 'yahoo',
    name: 'Yahoo News',
    color: '#6001D2',
    feeds: {
      top: 'https://news.yahoo.com/rss/',
      sports: 'https://sports.yahoo.com/rss/',
    },
  },
  {
    id: 'newsweek',
    name: 'Newsweek',
    color: '#D2232A',
    feeds: {
      top: 'https://www.newsweek.com/rss',
    },
  },
  {
    id: 'independent',
    name: 'The Independent',
    color: '#EC1A2E',
    feeds: {
      top: 'https://www.independent.co.uk/news/rss',
      world: 'https://www.independent.co.uk/news/world/rss',
      sports: 'https://www.independent.co.uk/sport/rss',
      tech: 'https://www.independent.co.uk/tech/rss',
      entertainment: 'https://www.independent.co.uk/arts-entertainment/rss',
    },
  },
  {
    id: 'dw',
    name: 'DW News',
    color: '#05437C',
    feeds: {
      top: 'https://rss.dw.com/rdf/rss-en-top',
      world: 'https://rss.dw.com/rdf/rss-en-world',
    },
  },
  {
    id: 'france24',
    name: 'France 24',
    color: '#0096D6',
    feeds: {
      top: 'https://www.france24.com/en/rss',
      world: 'https://www.france24.com/en/rss',
    },
  },
  {
    id: 'wired',
    name: 'Wired',
    color: '#1A1A1A',
    feeds: {
      tech: 'https://www.wired.com/feed/rss',
    },
  },
  {
    id: 'engadget',
    name: 'Engadget',
    color: '#7A2CF5',
    feeds: {
      tech: 'https://www.engadget.com/rss.xml',
    },
  },
  {
    id: 'thr',
    name: 'The Hollywood Reporter',
    color: '#B8862B',
    feeds: {
      entertainment: 'https://www.hollywoodreporter.com/feed/',
    },
  },
  {
    id: 'nypost',
    name: 'New York Post',
    color: '#C8102E',
    feeds: {
      top: 'https://nypost.com/news/feed/',
      sports: 'https://nypost.com/sports/feed/',
      tech: 'https://nypost.com/tech/feed/',
      entertainment: 'https://nypost.com/entertainment/feed/',
    },
  },
  {
    id: 'wapo',
    name: 'The Washington Post',
    color: '#1A1A1A',
    feeds: {
      top: 'https://feeds.washingtonpost.com/rss/national',
      world: 'https://feeds.washingtonpost.com/rss/world',
      sports: 'https://feeds.washingtonpost.com/rss/sports',
      tech: 'https://feeds.washingtonpost.com/rss/business/technology',
      entertainment: 'https://feeds.washingtonpost.com/rss/entertainment',
    },
  },
  {
    id: 'wsj',
    name: 'The Wall Street Journal',
    color: '#0274B6',
    feeds: {
      top: 'https://feeds.a.dj.com/rss/RSSWorldNews.xml',
      world: 'https://feeds.a.dj.com/rss/RSSWorldNews.xml',
      tech: 'https://feeds.a.dj.com/rss/RSSWSJD.xml',
      entertainment: 'https://feeds.a.dj.com/rss/RSSArtsCulture.xml',
    },
  },
  {
    // USA Today's own RSS was retired, so its stories come via Google News, like AP's.
    id: 'usatoday',
    name: 'USA Today',
    color: '#009BFF',
    titleSuffix: ' - USA Today',
    feeds: {
      top: googleNews('site:usatoday.com when:1d'),
      sports: googleNews('site:usatoday.com sports when:1d'),
      tech: googleNews('site:usatoday.com tech when:2d'),
      entertainment: googleNews('site:usatoday.com entertainment when:2d'),
    },
  },
  {
    // Bloomberg has no public RSS; its headlines come via Google News.
    id: 'bloomberg',
    name: 'Bloomberg',
    color: '#2800D7',
    titleSuffix: [' - Bloomberg.com', ' - Bloomberg'],
    feeds: {
      top: googleNews('site:bloomberg.com when:1d'),
      world: googleNews('site:bloomberg.com world when:1d'),
      tech: googleNews('site:bloomberg.com technology when:2d'),
    },
  },
  {
    id: 'cbc',
    name: 'CBC News',
    color: '#D40000',
    feeds: {
      top: 'https://www.cbc.ca/webfeed/rss/rss-topstories',
      world: 'https://www.cbc.ca/webfeed/rss/rss-world',
      sports: 'https://www.cbc.ca/webfeed/rss/rss-sports',
      tech: 'https://www.cbc.ca/webfeed/rss/rss-technology',
      entertainment: 'https://www.cbc.ca/webfeed/rss/rss-arts',
    },
  },
  {
    id: 'euronews',
    name: 'euronews',
    color: '#00287A',
    feeds: {
      top: 'https://www.euronews.com/rss',
      world: 'https://www.euronews.com/rss?level=theme&name=news',
    },
  },
  {
    id: 'atlantic',
    name: 'The Atlantic',
    color: '#1A1A1A',
    feeds: {
      top: 'https://www.theatlantic.com/feed/all/',
      tech: 'https://www.theatlantic.com/feed/channel/technology/',
      entertainment: 'https://www.theatlantic.com/feed/channel/entertainment/',
    },
  },
  {
    id: 'vox',
    name: 'Vox',
    color: '#E8CC00',
    feeds: {
      top: 'https://www.vox.com/rss/index.xml',
    },
  },
  {
    id: 'businessinsider',
    name: 'Business Insider',
    color: '#1B5FAA',
    feeds: {
      top: 'https://feeds.businessinsider.com/custom/all',
      tech: 'https://feeds.businessinsider.com/custom/tech',
    },
  },
  {
    id: 'deadline',
    name: 'Deadline',
    color: '#1A1A1A',
    feeds: {
      entertainment: 'https://deadline.com/feed/',
    },
  },
  {
    id: 'tmz',
    name: 'TMZ',
    color: '#C8102E',
    feeds: {
      entertainment: 'https://www.tmz.com/rss.xml',
    },
  },
  {
    id: 'skysports',
    name: 'Sky Sports',
    color: '#00205B',
    feeds: {
      sports: 'https://www.skysports.com/rss/12040',
    },
  },
  {
    id: 'sbnation',
    name: 'SB Nation',
    color: '#C4002D',
    feeds: {
      sports: 'https://www.sbnation.com/rss/current',
    },
  },
  {
    id: '9to5google',
    name: '9to5Google',
    color: '#1A73E8',
    feeds: {
      tech: 'https://9to5google.com/feed/',
    },
  },
  {
    id: 'sammobile',
    name: 'SamMobile',
    color: '#1428A0',
    feeds: {
      tech: 'https://www.sammobile.com/feed/',
    },
  },
];

function googleNews(query: string): string {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
}

export const SOURCE_IDS = SOURCES.map((s) => s.id);

export function getSource(id: SourceId): Source | undefined {
  return SOURCES.find((s) => s.id === id);
}

export interface TopicInfo {
  id: Topic;
  /** Chip label on the News tab. */
  label: string;
  /** Section and screen title. */
  title: string;
  /** Ionicons name for the chip's round badge. */
  icon: string;
  /** Badge colour. */
  color: string;
}

export const TOPICS: TopicInfo[] = [
  { id: 'top', label: 'News', title: 'Top stories', icon: 'newspaper', color: '#E3141B' },
  { id: 'world', label: 'World', title: 'World', icon: 'earth', color: '#1F6FD1' },
  { id: 'sports', label: 'Sports', title: 'Sports', icon: 'football', color: '#1E9E57' },
  { id: 'tech', label: 'Tech', title: 'Tech', icon: 'hardware-chip', color: '#6B4FD8' },
  { id: 'entertainment', label: 'Entertainment', title: 'Entertainment', icon: 'film', color: '#E0730F' },
];

export function getTopic(id: Topic): TopicInfo {
  return TOPICS.find((t) => t.id === id) ?? TOPICS[0]!;
}
