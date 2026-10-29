// Stock market quotes from Yahoo Finance's public chart data, with CNBC's public quote service as a
// fallback when Yahoo turns a request away (it rate-limits some networks). Neither needs an API key;
// prices can be delayed up to about 15 minutes. Kept free of React Native imports so CI can check it
// in Node.

export interface MarketSymbol {
  /** Yahoo Finance symbol; also used for the quote page. */
  symbol: string;
  /** The same instrument on CNBC. */
  cnbc: string;
  name: string;
  /** How the value reads: index points, a dollar price, or a yield in percent. */
  kind: 'index' | 'usd' | 'percent';
}

export const MARKET_SYMBOLS: MarketSymbol[] = [
  { symbol: '^GSPC', cnbc: '.SPX', name: 'S&P 500', kind: 'index' },
  { symbol: '^DJI', cnbc: '.DJI', name: 'Dow Jones', kind: 'index' },
  { symbol: '^IXIC', cnbc: '.IXIC', name: 'Nasdaq', kind: 'index' },
  { symbol: '^RUT', cnbc: '.RUT', name: 'Russell 2000', kind: 'index' },
  { symbol: 'BTC-USD', cnbc: 'BTC.CM=', name: 'Bitcoin', kind: 'usd' },
  { symbol: 'GC=F', cnbc: '@GC.1', name: 'Gold', kind: 'usd' },
  { symbol: 'CL=F', cnbc: '@CL.1', name: 'Crude oil', kind: 'usd' },
  { symbol: '^TNX', cnbc: 'US10Y', name: '10-yr Treasury', kind: 'percent' },
];

export interface Quote extends MarketSymbol {
  price: number;
  change: number;
  changePercent: number;
  /** Today's prices, oldest first, for the small chart. */
  points: number[];
  /** True during the regular trading session. */
  open: boolean;
  /** Milliseconds since epoch of the latest price. */
  time: number;
  provider: 'yahoo' | 'cnbc';
}

const HEADERS = {
  // Yahoo turns away requests that don't look like a browser.
  'User-Agent':
    'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
  Accept: 'application/json',
};
const HOSTS = ['https://query1.finance.yahoo.com', 'https://query2.finance.yahoo.com'];
const TIMEOUT_MS = 10_000;

interface ChartResponse {
  chart: {
    result?: {
      meta: {
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        previousClose?: number;
        regularMarketTime?: number;
        currentTradingPeriod?: { regular?: { start: number; end: number } };
      };
      indicators: { quote: { close?: (number | null)[] }[] };
    }[];
    error?: { description?: string } | null;
  };
}

async function getChart(symbol: string): Promise<ChartResponse> {
  let lastError: unknown;
  for (const host of HOSTS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const url = `${host}/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=15m`;
      const res = await fetch(url, { headers: HEADERS, signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as ChartResponse;
    } catch (err) {
      lastError = err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function fetchQuote(m: MarketSymbol): Promise<Quote> {
  const data = await getChart(m.symbol);
  const result = data.chart.result?.[0];
  if (!result) throw new Error(data.chart.error?.description ?? 'No data');
  const meta = result.meta;
  const points = (result.indicators.quote[0]?.close ?? []).filter((v): v is number => typeof v === 'number');
  const price = meta.regularMarketPrice ?? points[points.length - 1];
  const previous = meta.chartPreviousClose ?? meta.previousClose;
  if (price === undefined || previous === undefined) throw new Error('Incomplete quote');
  const now = Date.now() / 1000;
  const session = meta.currentTradingPeriod?.regular;
  return {
    ...m,
    price,
    change: price - previous,
    changePercent: previous ? ((price - previous) / previous) * 100 : 0,
    points,
    open: session ? now >= session.start && now < session.end : false,
    time: (meta.regularMarketTime ?? now) * 1000,
    provider: 'yahoo',
  };
}

interface CnbcQuote {
  symbol?: string;
  last?: string;
  change?: string;
  change_pct?: string;
  previous_day_closing?: string;
  curmktstatus?: string;
}

/** The nth (1-based) Sunday of a month, as a UTC date at midnight. */
function nthSunday(year: number, month: number, n: number): number {
  const first = new Date(Date.UTC(year, month, 1)).getUTCDay();
  return Date.UTC(year, month, 1 + ((7 - first) % 7) + (n - 1) * 7);
}

/**
 * Whether the New York Stock Exchange's regular session (9:30am–4pm Eastern, Monday to Friday) is
 * under way. Market holidays aren't counted. US daylight time runs from the second Sunday of March
 * to the first Sunday of November, both at 2am local.
 */
export function usMarketOpen(now = Date.now()): boolean {
  const year = new Date(now).getUTCFullYear();
  const dstStart = nthSunday(year, 2, 2) + 7 * 3600_000; // 2am EST is 7am UTC
  const dstEnd = nthSunday(year, 10, 1) + 6 * 3600_000; // 2am EDT is 6am UTC
  const offsetHours = now >= dstStart && now < dstEnd ? -4 : -5;
  const local = new Date(now + offsetHours * 3600_000);
  const day = local.getUTCDay();
  const minutes = local.getUTCHours() * 60 + local.getUTCMinutes();
  return day >= 1 && day <= 5 && minutes >= 9 * 60 + 30 && minutes < 16 * 60;
}

/** "6,843.12", "+0.37%", "-12.30" → numbers. */
function cnbcNumber(v: string | undefined): number {
  return Number(String(v ?? '').replace(/[,%+\s]/g, ''));
}

/** Several quotes in one request from CNBC's public quote service. No intraday chart. */
export async function fetchCnbcQuotes(symbols: MarketSymbol[]): Promise<Quote[]> {
  if (symbols.length === 0) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const list = encodeURIComponent(symbols.map((m) => m.cnbc).join('|'));
    const url =
      `https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol?symbols=${list}` +
      '&requestMethod=itv&noform=1&partnerId=2&fund=1&exthrs=1&output=json&events=1';
    const res = await fetch(url, { headers: HEADERS, signal: controller.signal });
    if (!res.ok) throw new Error(`CNBC HTTP ${res.status}`);
    const data = (await res.json()) as { FormattedQuoteResult?: { FormattedQuote?: CnbcQuote[] | CnbcQuote } };
    const raw = data.FormattedQuoteResult?.FormattedQuote;
    const rows = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return symbols.flatMap((m) => {
      const row = rows.find((r) => r.symbol === m.cnbc);
      const price = cnbcNumber(row?.last);
      if (!row || !Number.isFinite(price) || price === 0) return [];
      const previous = cnbcNumber(row.previous_day_closing);
      const change = Number.isFinite(cnbcNumber(row.change)) ? cnbcNumber(row.change) : price - previous;
      const pct = cnbcNumber(row.change_pct);
      return [
        {
          ...m,
          price,
          change,
          changePercent: Number.isFinite(pct) ? pct : previous ? (change / previous) * 100 : 0,
          points: [],
          // CNBC's status field can lag (it said REG_MKT overnight), so use the session hours.
          open: usMarketOpen(),
          time: Date.now(),
          provider: 'cnbc' as const,
        },
      ];
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Every quote that loads, in list order: Yahoo first, CNBC for any Yahoo turned away. */
export async function fetchQuotes(symbols: MarketSymbol[] = MARKET_SYMBOLS): Promise<Quote[]> {
  const results = await Promise.allSettled(symbols.map(fetchQuote));
  const got = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
  const missing = symbols.filter((m) => !got.some((q) => q.symbol === m.symbol));
  const fallback = await fetchCnbcQuotes(missing).catch(() => []);
  return symbols.flatMap((m) => [...got, ...fallback].filter((q) => q.symbol === m.symbol));
}

function number(n: number, digits: number): string {
  const fixed = Math.abs(n).toFixed(digits);
  const [whole, frac] = fixed.split('.');
  const grouped = whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (n < 0 ? '-' : '') + grouped + (frac ? `.${frac}` : '');
}

export function formatPrice(q: Pick<Quote, 'price' | 'kind'>): string {
  if (q.kind === 'percent') return `${q.price.toFixed(2)}%`;
  if (q.kind === 'usd') return `$${number(q.price, q.price >= 1000 ? 0 : 2)}`;
  return number(q.price, 2);
}

export function formatChange(q: Pick<Quote, 'change' | 'changePercent' | 'kind'>): string {
  const sign = q.change > 0 ? '+' : q.change < 0 ? '−' : '';
  // A yield's move reads in percentage points; everything else as a percent change.
  if (q.kind === 'percent') return `${sign}${Math.abs(q.change).toFixed(2)}`;
  return `${sign}${Math.abs(q.changePercent).toFixed(2)}%`;
}

export function quoteUrl(symbol: string): string {
  return `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}/`;
}
