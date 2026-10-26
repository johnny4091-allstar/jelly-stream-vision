// Looks up every Live TV channel the way the app does and prints what it finds, so a wrong handle
// or a channel that blocks embedding shows up in the CI log. Node 24 runs the TypeScript directly.
import { LIVE_CHANNELS, liveDebug, resolveLive } from '../src/live.ts';

liveDebug.log = (msg) => console.log(`    ${msg}`);

let live = 0;
for (const ch of LIVE_CHANNELS) {
  const r = await resolveLive(ch, true);
  if (r.status === 'live') live++;
  const detail = r.status === 'live' ? `${r.videoId} ${r.embeddable ? 'embeddable' : 'NOT embeddable (opens watch page)'}` : '';
  console.log(`${ch.name.padEnd(22)} ${r.status.padEnd(8)} ${detail}`);
}
console.log(`\n${live}/${LIVE_CHANNELS.length} channels live`);
if (live === 0) {
  console.log('::warning::No Live TV channel resolved. YouTube may have changed its page, or blocked this runner.');
}
