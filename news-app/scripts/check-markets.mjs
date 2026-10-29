// Fetches every market quote the way the app does, so a change to Yahoo's chart API shows up in the
// CI log.
import { MARKET_SYMBOLS, fetchQuote, formatChange, formatPrice } from '../src/services/markets.ts';

let ok = 0;
for (const m of MARKET_SYMBOLS) {
  try {
    const q = await fetchQuote(m);
    ok++;
    console.log(`${m.name.padEnd(16)} ${formatPrice(q).padStart(12)} ${formatChange(q).padStart(8)}  ${q.points.length} points  ${q.open ? 'open' : 'closed'}`);
  } catch (err) {
    console.log(`::warning::${m.name} (${m.symbol}) failed: ${err instanceof Error ? err.message : err}`);
  }
}
console.log(`\n${ok}/${MARKET_SYMBOLS.length} quotes`);
