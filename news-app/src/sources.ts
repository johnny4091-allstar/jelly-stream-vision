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
      business: 'http://rss.cnn.com/rss/money_latest.rss',
      politics: 'http://rss.cnn.com/rss/cnn_allpolitics.rss',
      health: 'http://rss.cnn.com/rss/cnn_health.rss',
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
      business: 'https://feeds.bbci.co.uk/news/business/rss.xml',
      politics: 'https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml',
      science: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml',
      health: 'https://feeds.bbci.co.uk/news/health/rss.xml',
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
      business: 'https://feeds.npr.org/1006/rss.xml',
      politics: 'https://feeds.npr.org/1014/rss.xml',
      science: 'https://feeds.npr.org/1007/rss.xml',
      health: 'https://feeds.npr.org/1128/rss.xml',
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
      business: googleNews('site:apnews.com business when:1d'),
      politics: googleNews('site:apnews.com politics when:1d'),
      science: googleNews('site:apnews.com science when:3d'),
      health: googleNews('site:apnews.com health when:3d'),
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
      politics: 'https://moxie.foxnews.com/google-publisher/politics.xml',
      science: 'https://moxie.foxnews.com/google-publisher/science.xml',
      health: 'https://moxie.foxnews.com/google-publisher/health.xml',
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
      science: 'https://www.theverge.com/rss/science/index.xml',
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
      business: 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml',
      politics: 'https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml',
      science: 'https://rss.nytimes.com/services/xml/rss/nyt/Science.xml',
      health: 'https://rss.nytimes.com/services/xml/rss/nyt/Health.xml',
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
      business: 'https://www.theguardian.com/us/business/rss',
      politics: 'https://www.theguardian.com/us-news/us-politics/rss',
      science: 'https://www.theguardian.com/science/rss',
      health: 'https://www.theguardian.com/society/health/rss',
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
      business: googleNews('site:reuters.com business when:1d'),
      politics: googleNews('site:reuters.com politics when:1d'),
      science: googleNews('site:reuters.com science when:3d'),
      health: googleNews('site:reuters.com healthcare when:3d'),
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
      business: 'https://abcnews.go.com/abcnews/moneyheadlines',
      politics: 'https://abcnews.go.com/abcnews/politicsheadlines',
      health: 'https://abcnews.go.com/abcnews/healthheadlines',
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
      business: 'https://www.cbsnews.com/latest/rss/moneywatch',
      politics: 'https://www.cbsnews.com/latest/rss/politics',
      science: 'https://www.cbsnews.com/latest/rss/science',
      health: 'https://www.cbsnews.com/latest/rss/health',
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
      business: 'https://feeds.nbcnews.com/nbcnews/public/business',
      politics: 'https://feeds.nbcnews.com/nbcnews/public/politics',
      science: 'https://feeds.nbcnews.com/nbcnews/public/science',
      health: 'https://feeds.nbcnews.com/nbcnews/public/health',
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
      business: 'https://feeds.skynews.com/feeds/rss/business.xml',
      politics: 'https://feeds.skynews.com/feeds/rss/politics.xml',
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
      science: 'https://feeds.arstechnica.com/arstechnica/science',
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
      business: 'https://www.pbs.org/newshour/feeds/rss/economy',
      politics: 'https://www.pbs.org/newshour/feeds/rss/politics',
      science: 'https://www.pbs.org/newshour/feeds/rss/science',
      health: 'https://www.pbs.org/newshour/feeds/rss/health',
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
      business: 'https://www.cnbc.com/id/10001147/device/rss/rss.html',
      politics: 'https://www.cnbc.com/id/10000113/device/rss/rss.html',
      health: 'https://www.cnbc.com/id/10000108/device/rss/rss.html',
    },
  },
  {
    id: 'politico',
    name: 'Politico',
    color: '#B4171E',
    feeds: {
      top: 'https://rss.politico.com/politics-news.xml',
      politics: 'https://rss.politico.com/politics-news.xml',
    },
  },
  {
    id: 'thehill',
    name: 'The Hill',
    color: '#00529B',
    feeds: {
      top: 'https://thehill.com/news/feed/',
      tech: 'https://thehill.com/policy/technology/feed/',
      politics: 'https://thehill.com/homenews/feed/',
      business: 'https://thehill.com/business/feed/',
      health: 'https://thehill.com/policy/healthcare/feed/',
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
      business: 'https://www.latimes.com/business/rss2.0.xml',
      politics: 'https://www.latimes.com/politics/rss2.0.xml',
      science: 'https://www.latimes.com/science/rss2.0.xml',
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
    id: 'independent',
    name: 'The Independent',
    color: '#EC1A2E',
    feeds: {
      top: 'https://www.independent.co.uk/news/rss',
      world: 'https://www.independent.co.uk/news/world/rss',
      sports: 'https://www.independent.co.uk/sport/rss',
      tech: 'https://www.independent.co.uk/tech/rss',
      entertainment: 'https://www.independent.co.uk/arts-entertainment/rss',
      business: 'https://www.independent.co.uk/news/business/rss',
      politics: 'https://www.independent.co.uk/news/world/americas/us-politics/rss',
      science: 'https://www.independent.co.uk/news/science/rss',
      health: 'https://www.independent.co.uk/life-style/health-and-families/rss',
    },
  },
  {
    id: 'dw',
    name: 'DW News',
    color: '#05437C',
    feeds: {
      top: 'https://rss.dw.com/rdf/rss-en-top',
      world: 'https://rss.dw.com/rdf/rss-en-world',
      business: 'https://rss.dw.com/rdf/rss-en-bus',
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
      science: 'https://www.wired.com/feed/category/science/latest/rss',
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
      business: 'https://nypost.com/business/feed/',
      politics: 'https://nypost.com/politics/feed/',
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
      business: 'https://feeds.a.dj.com/rss/WSJcomUSBusiness.xml',
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
      business: googleNews('site:usatoday.com money when:1d'),
      politics: googleNews('site:usatoday.com politics when:1d'),
      health: googleNews('site:usatoday.com health when:3d'),
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
      business: googleNews('site:bloomberg.com markets when:1d'),
      politics: googleNews('site:bloomberg.com politics when:1d'),
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
      business: 'https://www.cbc.ca/webfeed/rss/rss-business',
      politics: 'https://www.cbc.ca/webfeed/rss/rss-politics',
      health: 'https://www.cbc.ca/webfeed/rss/rss-health',
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
      politics: 'https://www.theatlantic.com/feed/channel/politics/',
      science: 'https://www.theatlantic.com/feed/channel/science/',
      health: 'https://www.theatlantic.com/feed/channel/health/',
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
      business: 'https://feeds.businessinsider.com/custom/all',
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
  {
    id: 'marketwatch',
    name: 'MarketWatch',
    color: '#00AC4E',
    feeds: {
      business: 'https://feeds.content.dowjones.io/public/rss/mw_topstories',
    },
  },
  {
    id: 'sciencedaily',
    name: 'ScienceDaily',
    color: '#1C4E80',
    feeds: {
      science: 'https://www.sciencedaily.com/rss/top/science.xml',
      health: 'https://www.sciencedaily.com/rss/top/health.xml',
    },
  },
  {
    id: 'nasa',
    name: 'NASA',
    color: '#0B3D91',
    feeds: {
      science: 'https://www.nasa.gov/news-release/feed/',
    },
  },
  {
    id: 'statnews',
    name: 'STAT',
    color: '#C8102E',
    feeds: {
      health: 'https://www.statnews.com/feed/',
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
  { id: 'business', label: 'Business', title: 'Business & markets', icon: 'trending-up', color: '#0E8A5F' },
  { id: 'politics', label: 'Politics', title: 'Politics', icon: 'flag', color: '#B4171E' },
  { id: 'sports', label: 'Sports', title: 'Sports', icon: 'football', color: '#1E9E57' },
  { id: 'tech', label: 'Tech', title: 'Tech', icon: 'hardware-chip', color: '#6B4FD8' },
  { id: 'science', label: 'Science', title: 'Science', icon: 'flask', color: '#0A84C6' },
  { id: 'health', label: 'Health', title: 'Health', icon: 'heart', color: '#E0457B' },
  { id: 'entertainment', label: 'Entertainment', title: 'Entertainment', icon: 'film', color: '#E0730F' },
];

export function getTopic(id: Topic): TopicInfo {
  return TOPICS.find((t) => t.id === id) ?? TOPICS[0]!;
}
