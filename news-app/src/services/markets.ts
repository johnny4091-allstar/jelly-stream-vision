// Stock market quotes from Yahoo Finance's public chart data (no API key). Prices can be delayed
// up to about 15 minutes. Kept free of React Native imports so CI can check it in Node.

export interface MarketSymbol {
  symbol: string;
  name: string;
  /** How the value reads: index points, a dollar price, or a yield in percent. */
  kind: 'index' | 'usd' | 'percent';
}

export const MARKET_SYMBOLS: MarketSymbol[] = [
  { symbol: '^GSPC', name: 'S&P 500', kind: 'index' },
  { symbol: '^DJI', name: 'Dow Jones', kind: 'index' },
  { symbol: '^IXIC', name: 'Nasdaq', kind: 'index' },
  { symbol: '^RUT', name: 'Russell 2000', kind: 'index' },
  { symbol: 'BTC-USD', name: 'Bitcoin', kind: 'usd' },
  { symbol: 'GC=F', name: 'Gold', kind: 'usd' },
  { symbol: 'CL=F', name: 'Crude oil', kind: 'usd' },
  { symbol: '^TNX', name: '10-yr Treasury', kind: 'percent' },
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
  };
}

/** Every quote that loads; a symbol that fails is left out. */
export async function fetchQuotes(symbols: MarketSymbol[] = MARKET_SYMBOLS): Promise<Quote[]> {
  const results = await Promise.allSettled(symbols.map(fetchQuote));
  return results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
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
