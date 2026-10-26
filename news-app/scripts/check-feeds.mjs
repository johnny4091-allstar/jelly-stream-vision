// Fetches every news feed and parses it the way the app does, so a dead or moved feed shows up in
// the CI log. Node 24 runs the TypeScript directly.
import { parseFeed } from '../src/services/parse.ts';
import { SOURCES } from '../src/sources.ts';

let ok = 0;
let total = 0;
for (const source of SOURCES) {
  for (const [topic, url] of Object.entries(source.feeds)) {
    total++;
    let line;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const stories = parseFeed(await res.text(), source);
      if (stories.length === 0) throw new Error('no stories');
      ok++;
      const images = stories.filter((s) => s.imageUrl).length;
      const dated = stories.filter((s) => s.publishedAt).length;
      line = `ok      ${stories.length} stories, ${images} with pictures, ${dated} dated`;
    } catch (err) {
      line = `FAILED  ${err instanceof Error ? err.message : err}`;
      console.log(`::warning::${source.name} ${topic} feed failed: ${url}`);
    }
    console.log(`${source.name.padEnd(20)} ${topic.padEnd(14)} ${line}`);
  }
}
console.log(`\n${ok}/${total} feeds working`);
