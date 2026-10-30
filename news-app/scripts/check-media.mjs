// Fetches every news channel's YouTube feed and every podcast feed the way the app does, so a wrong
// channel id or a moved podcast shows up in the CI log.
import { PODCASTS, VIDEO_CHANNELS, fetchChannelVideos, fetchPodcastEpisodes, formatDuration } from '../src/media.ts';

const ago = (ms) => (ms ? `${Math.round((Date.now() - ms) / 3600_000)}h ago` : 'no date');
let ok = 0;
for (const ch of VIDEO_CHANNELS) {
  try {
    const v = await fetchChannelVideos(ch, true);
    if (v.length === 0) throw new Error('no videos');
    ok++;
    console.log(`video  ${ch.name.padEnd(20)} ${String(v.length).padStart(2)} videos, newest ${ago(v[0].publishedAt)}: ${v[0].title.slice(0, 60)}`);
  } catch (err) {
    console.log(`::warning::Video channel ${ch.name} failed: ${err instanceof Error ? err.message : err}`);
  }
}
for (const p of PODCASTS) {
  try {
    const e = await fetchPodcastEpisodes(p, true);
    if (e.length === 0) throw new Error('no episodes with audio');
    ok++;
    console.log(`pod    ${p.name.padEnd(20)} ${String(e.length).padStart(3)} episodes, newest ${ago(e[0].publishedAt)} ${formatDuration(e[0].duration)}${e[0].imageUrl ? '' : ' (no artwork)'}: ${e[0].title.slice(0, 50)}`);
  } catch (err) {
    console.log(`::warning::Podcast ${p.name} failed: ${err instanceof Error ? err.message : err}`);
  }
}
console.log(`\n${ok}/${VIDEO_CHANNELS.length + PODCASTS.length} video channels and podcasts working`);
