// Fetches the radar frame list and one tile the way the app does, so a change to RainViewer's free
// API shows up in the CI log.
import { baseTileUrl, fetchRadarFrames, radarTileUrl, worldPixel } from '../src/services/radar.ts';

try {
  const { host, frames } = await fetchRadarFrames(true);
  const latest = frames[frames.length - 1];
  console.log(`${frames.length} radar frames, latest ${new Date(latest.time * 1000).toISOString()}`);
  const p = worldPixel(40.71, -74.01, 7);
  const [x, y] = [Math.floor(p.x / 256), Math.floor(p.y / 256)];
  const key = process.env.CARTO_KEY || undefined;
  console.log(key ? 'Using the CARTO_KEY secret for the street map' : 'No CARTO_KEY secret: open CARTO tiles');
  for (const url of [radarTileUrl(host, latest, 7, x, y), baseTileUrl(false, 7, x, y, key), baseTileUrl(true, 7, x, y, key)]) {
    const res = await fetch(url);
    const body = await res.arrayBuffer();
    // The key stays out of the log.
    console.log(`${res.status} ${res.headers.get('content-type')} ${body.byteLength} bytes  ${url.replace(/key=[^&]+/, 'key=***')}`);
    if (!res.ok) console.log(`::warning::Radar tile failed: ${url}`);
  }
} catch (err) {
  console.log(`::warning::Radar check failed: ${err instanceof Error ? err.message : err}`);
}
