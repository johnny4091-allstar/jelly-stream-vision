import { XMLParser } from 'fast-xml-parser';

import type { Source, Story } from '../types';

// Pure RSS 2.0 / Atom parsing. No network or storage here so it can be tested in Node.

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  // CDATA sections are merged into the text value.
  processEntities: true,
  htmlEntities: true,
  parseTagValue: false,
  trimValues: true,
  isArray: (name) =>
    ['item', 'entry', 'link', 'media:content', 'media:thumbnail', 'enclosure'].includes(name),
});

type Node = Record<string, unknown>;

const SUMMARY_MAX = 220;

function asArray(v: unknown): unknown[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function text(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) return text(v[0]);
  if (typeof v === 'object') return text((v as Node)['#text']);
  return '';
}

function attr(v: unknown, name: string): string | undefined {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const a = (v as Node)[`@_${name}`];
    if (typeof a === 'string' && a) return a;
  }
  return undefined;
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  mdash: '—',
  ndash: '–',
  hellip: '…',
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
}

/** Strips tags and entities from a feed's HTML snippet. */
export function cleanText(html: string): string {
  const s = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/p>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  // Entities can be double-encoded (e.g. &amp;#8217;), so decode twice.
  return decodeEntities(decodeEntities(s)).replace(/\s+/g, ' ').trim();
}

/** Turns an HTML snippet from a feed into a short plain-text summary. */
export function toSummary(html: string): string {
  const s = cleanText(html);
  if (s.length <= SUMMARY_MAX) return s;
  const cut = s.slice(0, SUMMARY_MAX);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 120 ? lastSpace : SUMMARY_MAX).replace(/[\s,;:.—-]+$/, '')}…`;
}

// Tracking pixels and share buttons that feeds embed in their HTML.
const JUNK_IMAGE = /feedburner|feedsportal|pixel|tracking|doubleclick|\/ads?\/|1x1|spacer/i;

function firstImgSrc(html: string): string | undefined {
  const re = /<img[^>]+src=["']([^"']+)["']/gi;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    const src = decodeEntities(m[1] ?? '');
    if (/^https?:\/\//.test(src) && !JUNK_IMAGE.test(src)) return src;
  }
  return undefined;
}

function isImage(node: unknown): boolean {
  const medium = attr(node, 'medium');
  const type = attr(node, 'type');
  if (medium) return medium === 'image';
  if (type) return type.startsWith('image/');
  return /\.(jpe?g|png|webp|gif)(\?|$)/i.test(attr(node, 'url') ?? '');
}

/** Picks the widest image from a list of media:content / media:thumbnail nodes. */
function bestMedia(nodes: unknown[]): string | undefined {
  let best: string | undefined;
  let bestWidth = -1;
  for (const n of nodes) {
    const url = attr(n, 'url');
    if (!url || !isImage(n)) continue;
    const width = Number(attr(n, 'width') ?? 0);
    if (width > bestWidth) {
      best = url;
      bestWidth = width;
    }
  }
  return best;
}

function upgradeImage(url: string): string {
  let u = url.replace(/^http:\/\//, 'https://');
  // BBC thumbnails are 240px; the same CDN serves larger renditions.
  u = u.replace(/(ichef\.bbci\.co\.uk\/(?:news|ace\/standard))\/\d+\//, '$1/800/');
  return u;
}

function findImage(item: Node, htmlFields: string[]): string | undefined {
  const group = item['media:group'] as Node | undefined;
  const candidates = [
    bestMedia(asArray(item['media:content'])),
    group ? bestMedia(asArray(group['media:content'])) : undefined,
    bestMedia(asArray(item['media:thumbnail'])),
    group ? bestMedia(asArray(group['media:thumbnail'])) : undefined,
    asArray(item.enclosure).map((e) => (isImage(e) ? attr(e, 'url') : undefined)).find(Boolean),
    attr(item['itunes:image'], 'href'),
    // ESPN and some others use a bare <image>https://…</image> element.
    /^https?:\/\/\S+$/.test(text(item.image).trim()) ? text(item.image).trim() : undefined,
    ...htmlFields.map((f) => firstImgSrc(text(item[f]))),
  ];
  const found = candidates.find((c): c is string => !!c);
  return found ? upgradeImage(found) : undefined;
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};
const ZONES: Record<string, number> = {
  UT: 0, UTC: 0, GMT: 0, Z: 0, EST: -5, EDT: -4, CST: -6, CDT: -5, MST: -7, MDT: -6, PST: -8, PDT: -7, BST: 1,
};

/**
 * Parses RFC 822 (RSS) and ISO 8601 (Atom) dates. Hermes' Date.parse doesn't reliably handle
 * RFC 822 with named zones, so that format is parsed by hand.
 */
export function parseDate(raw: string): number {
  const s = raw.trim();
  if (!s) return 0;
  const m = /(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*\s+(\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([+-]\d{2}:?\d{2}|[A-Za-z]{1,4})?/.exec(s);
  if (m) {
    const [, d, mon, y, hh, mm, ss, zone] = m;
    const month = MONTHS[mon!.toLowerCase()];
    if (month !== undefined) {
      let year = Number(y);
      if (year < 100) year += 2000;
      let offsetMin = 0;
      if (zone) {
        if (/^[+-]/.test(zone)) {
          const z = zone.replace(':', '');
          const sign = z[0] === '-' ? -1 : 1;
          offsetMin = sign * (Number(z.slice(1, 3)) * 60 + Number(z.slice(3, 5)));
        } else {
          offsetMin = (ZONES[zone.toUpperCase()] ?? 0) * 60;
        }
      }
      const utc = Date.UTC(year, month, Number(d), Number(hh), Number(mm), Number(ss ?? 0));
      return utc - offsetMin * 60_000;
    }
  }
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : 0;
}

function atomLink(entry: Node): string {
  const links = asArray(entry.link);
  const alt =
    links.find((l) => attr(l, 'rel') === 'alternate') ?? links.find((l) => !attr(l, 'rel')) ?? links[0];
  return attr(alt, 'href') ?? text(alt);
}

function makeStory(source: Source, fields: Omit<Story, 'id' | 'sourceId' | 'sourceName'>): Story | null {
  const link = fields.link.trim();
  let title = cleanText(fields.title);
  for (const suffix of [source.titleSuffix ?? []].flat()) {
    if (title.toLowerCase().endsWith(suffix.toLowerCase())) {
      title = title.slice(0, -suffix.length);
      break;
    }
  }
  if (!link || !title || !/^https?:\/\//.test(link)) return null;
  // Aggregator feeds repeat the headline as the description, and some feeds send a literal "null".
  const summary = fields.summary.startsWith(title) || /^(null|undefined)$/i.test(fields.summary) ? '' : fields.summary;
  return { ...fields, title, summary, link, id: link, sourceId: source.id, sourceName: source.name };
}

export function parseFeed(xml: string, source: Source): Story[] {
  const doc = parser.parse(xml) as Node;
  const stories: Story[] = [];

  const channel = (doc.rss as Node | undefined)?.channel as Node | undefined;
  const rdf = doc['rdf:RDF'] as Node | undefined;
  const rssItems = asArray(channel?.item ?? rdf?.item) as Node[];
  for (const item of rssItems) {
    const desc = text(item.description);
    const story = makeStory(source, {
      title: text(item.title),
      link: text(item.link) || (attr(item.guid, 'isPermaLink') !== 'false' ? text(item.guid) : ''),
      summary: toSummary(desc || text(item['content:encoded'])),
      imageUrl: findImage(item, ['content:encoded', 'description']),
      publishedAt: parseDate(text(item.pubDate) || text(item['dc:date'])),
    });
    if (story) stories.push(story);
  }

  const feed = doc.feed as Node | undefined;
  for (const entry of asArray(feed?.entry) as Node[]) {
    const story = makeStory(source, {
      title: text(entry.title),
      link: atomLink(entry),
      summary: toSummary(text(entry.summary) || text(entry.content)),
      imageUrl: findImage(entry, ['content', 'summary']),
      publishedAt: parseDate(text(entry.published) || text(entry.updated)),
    });
    if (story) stories.push(story);
  }

  return stories;
}
