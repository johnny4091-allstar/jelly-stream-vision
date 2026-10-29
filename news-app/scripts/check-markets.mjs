// Fetches every market quote the way the app does, so a change to Yahoo's chart API shows up in the
// CI log.
import { MARKET_SYMBOLS, fetchCnbcQuotes, fetchQuote, fetchQuotes, formatChange, formatPrice } from '../src/services/markets.ts';

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
console.log(`\n${ok}/${MARKET_SYMBOLS.length} quotes from Yahoo`);

// The fallback on its own, so a break there shows up even while Yahoo works.
const cnbc = await fetchCnbcQuotes(MARKET_SYMBOLS).catch((err) => {
  console.log(`::warning::CNBC quotes failed: ${err instanceof Error ? err.message : err}`);
  return [];
});
for (const q of cnbc) console.log(`CNBC ${q.name.padEnd(16)} ${formatPrice(q).padStart(12)} ${formatChange(q).padStart(8)}  ${q.open ? 'open' : 'closed'}`);
console.log(`${cnbc.length}/${MARKET_SYMBOLS.length} quotes from CNBC`);

const all = await fetchQuotes();
console.log(`${all.length}/${MARKET_SYMBOLS.length} quotes as the app gets them (${all.map((q) => q.provider).join(' ')})`);
if (all.length === 0) console.log('::warning::No market quotes from either source.');
