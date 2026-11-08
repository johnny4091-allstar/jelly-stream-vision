// "Pulse": where in the world the news is right now, found from place names in headlines.
// Pure (no React Native imports) so CI can check it in Node.

import type { Story } from '../types';

export interface Place {
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** Words that mean this place in a headline (matched as whole words, any case). */
  words: string[];
}

export const PLACES: Place[] = [
  { id: 'us', name: 'Washington', lat: 38.9, lon: -77.0, words: ['washington', 'white house', 'congress', 'senate', 'pentagon', 'capitol hill'] },
  { id: 'nyc', name: 'New York', lat: 40.7, lon: -74.0, words: ['new york', 'nyc', 'manhattan', 'brooklyn', 'wall street'] },
  { id: 'ca', name: 'California', lat: 36.8, lon: -119.4, words: ['california', 'los angeles', 'san francisco', 'silicon valley', 'l.a.'] },
  { id: 'tx', name: 'Texas', lat: 31.0, lon: -99.0, words: ['texas', 'houston', 'dallas', 'austin'] },
  { id: 'fl', name: 'Florida', lat: 27.8, lon: -81.7, words: ['florida', 'miami', 'tampa', 'orlando'] },
  { id: 'canada', name: 'Canada', lat: 56.1, lon: -106.3, words: ['canada', 'canadian', 'ottawa', 'toronto', 'vancouver', 'montreal'] },
  { id: 'mexico', name: 'Mexico', lat: 23.6, lon: -102.5, words: ['mexico', 'mexican'] },
  { id: 'brazil', name: 'Brazil', lat: -14.2, lon: -51.9, words: ['brazil', 'brazilian'] },
  { id: 'argentina', name: 'Argentina', lat: -38.4, lon: -63.6, words: ['argentina', 'argentine'] },
  { id: 'venezuela', name: 'Venezuela', lat: 6.4, lon: -66.6, words: ['venezuela', 'venezuelan', 'caracas'] },
  { id: 'uk', name: 'UK', lat: 51.5, lon: -0.1, words: ['uk', 'britain', 'british', 'london', 'england', 'scotland', 'starmer'] },
  { id: 'france', name: 'France', lat: 48.9, lon: 2.4, words: ['france', 'french', 'paris', 'macron'] },
  { id: 'germany', name: 'Germany', lat: 52.5, lon: 13.4, words: ['germany', 'german', 'berlin'] },
  { id: 'eu', name: 'Brussels', lat: 50.8, lon: 4.4, words: ['eu', 'european union', 'brussels', 'nato'] },
  { id: 'italy', name: 'Italy', lat: 41.9, lon: 12.5, words: ['italy', 'italian', 'rome', 'vatican', 'pope'] },
  { id: 'spain', name: 'Spain', lat: 40.4, lon: -3.7, words: ['spain', 'spanish', 'madrid'] },
  { id: 'ukraine', name: 'Ukraine', lat: 50.4, lon: 30.5, words: ['ukraine', 'ukrainian', 'kyiv', 'zelensky'] },
  { id: 'russia', name: 'Russia', lat: 55.8, lon: 37.6, words: ['russia', 'russian', 'moscow', 'kremlin', 'putin'] },
  { id: 'israel', name: 'Israel', lat: 31.8, lon: 35.2, words: ['israel', 'israeli', 'jerusalem', 'tel aviv', 'netanyahu'] },
  { id: 'gaza', name: 'Gaza', lat: 31.4, lon: 34.4, words: ['gaza', 'hamas', 'palestinian', 'west bank'] },
  { id: 'iran', name: 'Iran', lat: 35.7, lon: 51.4, words: ['iran', 'iranian', 'tehran'] },
  { id: 'saudi', name: 'Saudi Arabia', lat: 24.7, lon: 46.7, words: ['saudi', 'riyadh'] },
  { id: 'turkey', name: 'Turkey', lat: 39.9, lon: 32.9, words: ['turkey', 'turkish', 'ankara', 'istanbul', 'erdogan'] },
  { id: 'egypt', name: 'Egypt', lat: 30.0, lon: 31.2, words: ['egypt', 'egyptian', 'cairo'] },
  { id: 'nigeria', name: 'Nigeria', lat: 9.1, lon: 7.4, words: ['nigeria', 'nigerian', 'lagos'] },
  { id: 'sudan', name: 'Sudan', lat: 15.5, lon: 32.5, words: ['sudan', 'sudanese', 'khartoum'] },
  { id: 'southafrica', name: 'South Africa', lat: -26.2, lon: 28.0, words: ['south africa', 'johannesburg', 'cape town'] },
  { id: 'kenya', name: 'Kenya', lat: -1.3, lon: 36.8, words: ['kenya', 'kenyan', 'nairobi'] },
  { id: 'india', name: 'India', lat: 28.6, lon: 77.2, words: ['india', 'indian', 'delhi', 'mumbai', 'modi'] },
  { id: 'pakistan', name: 'Pakistan', lat: 33.7, lon: 73.1, words: ['pakistan', 'pakistani', 'islamabad'] },
  { id: 'china', name: 'China', lat: 39.9, lon: 116.4, words: ['china', 'chinese', 'beijing', 'shanghai', 'xi jinping'] },
  { id: 'hongkong', name: 'Hong Kong', lat: 22.3, lon: 114.2, words: ['hong kong'] },
  { id: 'taiwan', name: 'Taiwan', lat: 25.0, lon: 121.5, words: ['taiwan', 'taiwanese', 'taipei'] },
  { id: 'japan', name: 'Japan', lat: 35.7, lon: 139.7, words: ['japan', 'japanese', 'tokyo'] },
  { id: 'korea', name: 'Korea', lat: 37.6, lon: 127.0, words: ['korea', 'korean', 'seoul', 'pyongyang'] },
  { id: 'australia', name: 'Australia', lat: -33.9, lon: 151.2, words: ['australia', 'australian', 'sydney', 'melbourne', 'canberra'] },
];

function escape(word: string): string {
  return word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const MATCHERS = PLACES.map((p) => ({
  place: p,
  // Whole words only, so "Iran" doesn't match "Irani..." and "uk" doesn't match "ukulele".
  re: new RegExp(`(^|[^a-z])(${p.words.map(escape).join('|')})([^a-z]|$)`, 'i'),
}));

/** The places a story is about (from its headline, then its summary if the headline names none). */
export function placesIn(story: Pick<Story, 'title' | 'summary'>): Place[] {
  const inTitle = MATCHERS.filter((m) => m.re.test(story.title)).map((m) => m.place);
  if (inTitle.length) return inTitle;
  return MATCHERS.filter((m) => m.re.test(story.summary ?? '')).map((m) => m.place);
}

export interface Hotspot {
  place: Place;
  stories: Story[];
}

/** Places in the news within `hours`, busiest first. */
export function hotspots(stories: Story[], now = Date.now(), hours = 24): Hotspot[] {
  const since = now - hours * 3600_000;
  const byPlace = new Map<string, Hotspot>();
  const seen = new Set<string>();
  for (const s of stories) {
    if (seen.has(s.link) || (s.publishedAt && s.publishedAt < since)) continue;
    seen.add(s.link);
    for (const place of placesIn(s)) {
      const h = byPlace.get(place.id) ?? { place, stories: [] };
      h.stories.push(s);
      byPlace.set(place.id, h);
    }
  }
  return [...byPlace.values()]
    .map((h) => ({ ...h, stories: h.stories.sort((a, b) => b.publishedAt - a.publishedAt) }))
    .sort((a, b) => b.stories.length - a.stories.length);
}

/**
 * Orthographic projection: where a point on a globe of radius 1, turned so that `lon0`, `lat0` faces
 * the viewer, lands on screen (x right, y down). `visible` is false on the far side.
 */
export function project(lat: number, lon: number, lon0: number, lat0 = 15): { x: number; y: number; visible: boolean } {
  const r = Math.PI / 180;
  const φ = lat * r;
  const λ = (lon - lon0) * r;
  const φ0 = lat0 * r;
  const cosc = Math.sin(φ0) * Math.sin(φ) + Math.cos(φ0) * Math.cos(φ) * Math.cos(λ);
  return {
    x: Math.cos(φ) * Math.sin(λ),
    y: -(Math.cos(φ0) * Math.sin(φ) - Math.sin(φ0) * Math.cos(φ) * Math.cos(λ)),
    visible: cosc > 0,
  };
}
