// Rain radar from RainViewer (free, no API key): a mosaic of weather radars worldwide, published
// as map tiles every 10 minutes. Kept free of React Native imports so CI can check it in Node.

import type { Coords } from './weather';

export interface RadarFrame {
  /** Seconds since epoch. */
  time: number;
  path: string;
}

export interface RadarFrames {
  host: string;
  /** Oldest first; the last one is the latest radar image. */
  frames: RadarFrame[];
}

/** RainViewer's free tiles stop at this zoom; maps scale them up beyond it. */
export const RADAR_MAX_ZOOM = 7;
/** Colour scheme 2 ("Universal Blue"), smoothed, with snow shown in its own colour. */
const RADAR_STYLE = '2/1_1';
const CACHE_MS = 5 * 60 * 1000;

let cached: { at: number; frames: RadarFrames } | null = null;

export async function fetchRadarFrames(force = false): Promise<RadarFrames> {
  if (!force && cached && Date.now() - cached.at < CACHE_MS) return cached.frames;
  const res = await fetch('https://api.rainviewer.com/public/weather-maps.json');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { host: string; radar?: { past?: RadarFrame[] } };
  const frames = { host: data.host, frames: data.radar?.past ?? [] };
  if (frames.frames.length === 0) throw new Error('no radar frames');
  cached = { at: Date.now(), frames };
  return frames;
}

export function radarTileUrl(host: string, frame: RadarFrame, z: number, x: number, y: number): string {
  return `${host}${frame.path}/256/${z}/${x}/${y}/${RADAR_STYLE}.png`;
}

/** Leaflet-style template for the same tiles. */
export function radarTileTemplate(host: string, frame: RadarFrame): string {
  return `${host}${frame.path}/256/{z}/{x}/{y}/${RADAR_STYLE}.png`;
}

/** Street map under the radar (CARTO's free basemaps, OpenStreetMap data). */
export function baseTileUrl(dark: boolean, z: number, x: number, y: number): string {
  return `https://basemaps.cartocdn.com/${dark ? 'dark_all' : 'light_all'}/${z}/${x}/${y}.png`;
}

export const RADAR_CREDIT = 'Radar: RainViewer · Map: © CARTO, © OpenStreetMap';

/** A point in Web Mercator "world pixels" at a zoom level (256-pixel tiles). */
export function worldPixel(latitude: number, longitude: number, z: number): { x: number; y: number } {
  const size = 256 * 2 ** z;
  const lat = (Math.max(-85, Math.min(85, latitude)) * Math.PI) / 180;
  return {
    x: ((longitude + 180) / 360) * size,
    y: ((1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2) * size,
  };
}

/**
 * Leaflet map with the last two hours of radar playing as a loop. Pinch to zoom and drag to look
 * around; the play button pauses on a frame.
 */
export function radarHtml(frames: RadarFrames, coords: Coords, located: boolean, dark: boolean): string {
  const layers = frames.frames.map((f) => ({ url: radarTileTemplate(frames.host, f), time: f.time }));
  const base = `https://{s}.basemaps.cartocdn.com/${dark ? 'dark_all' : 'light_all'}/{z}/{x}/{y}{r}.png`;
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
html,body,#map{margin:0;height:100%;background:${dark ? '#1B1D22' : '#E8EAED'}}
.bar{position:absolute;left:12px;right:12px;bottom:30px;z-index:1000;display:flex;align-items:center;gap:12px;
background:${dark ? 'rgba(30,30,34,0.92)' : 'rgba(255,255,255,0.95)'};color:${dark ? '#F2F2F4' : '#111114'};
border-radius:16px;padding:10px 14px;font:600 15px system-ui,sans-serif;box-shadow:0 2px 10px rgba(0,0,0,.2)}
.bar button{border:0;border-radius:50%;width:40px;height:40px;background:#2D74D6;color:#fff;font-size:16px}
.bar input{flex:1;accent-color:#2D74D6}
.me{width:14px;height:14px;border-radius:50%;background:#2D74D6;border:3px solid #fff;box-shadow:0 0 4px rgba(0,0,0,.4)}
</style></head><body><div id="map"></div>
<div class="bar"><button id="play" aria-label="Play or pause">❚❚</button><input id="slider" type="range" min="0" step="1"><span id="time"></span></div>
<script>
var frames=${JSON.stringify(layers)};
var map=L.map('map',{zoomControl:false,attributionControl:true,maxZoom:10,minZoom:3})
  .setView([${coords.latitude},${coords.longitude}],${located ? 7 : 4});
map.attributionControl.setPrefix(false);
L.tileLayer(${JSON.stringify(base)},{subdomains:'abcd',maxZoom:10,attribution:${JSON.stringify(RADAR_CREDIT)}}).addTo(map);
${located ? `L.marker([${coords.latitude},${coords.longitude}],{icon:L.divIcon({className:'',html:'<div class="me"></div>',iconSize:[20,20]})}).addTo(map);` : ''}
var layers=frames.map(function(f){return L.tileLayer(f.url,{opacity:0,maxNativeZoom:${RADAR_MAX_ZOOM},maxZoom:10,zIndex:5}).addTo(map)});
var i=frames.length-1,playing=true,slider=document.getElementById('slider'),label=document.getElementById('time'),btn=document.getElementById('play');
slider.max=frames.length-1;
function fmt(t){var d=new Date(t*1000),h=d.getHours();return (h%12||12)+':'+('0'+d.getMinutes()).slice(-2)+(h<12?'am':'pm')}
function show(n){layers[i].setOpacity(0);i=n;layers[i].setOpacity(0.75);slider.value=i;label.textContent=fmt(frames[i].time)}
show(i);
setInterval(function(){if(playing)show((i+1)%frames.length)},700);
btn.onclick=function(){playing=!playing;btn.textContent=playing?'❚❚':'▶'};
slider.oninput=function(){playing=false;btn.textContent='▶';show(+slider.value)};
</script></body></html>`;
}
