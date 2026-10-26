import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { openRadar } from '../navigation';
import { cartoKey } from '../services/mapKey';
import {
  RADAR_MAX_ZOOM,
  baseTileUrl,
  fetchRadarFrames,
  radarTileUrl,
  worldPixel,
  type RadarFrames,
} from '../services/radar';
import type { Coords } from '../services/weather';

/** Latest radar frames, fetched when the component mounts. `frames` is null while loading. */
export function useRadarFrames(): { frames: RadarFrames | null; failed: boolean } {
  const [frames, setFrames] = useState<RadarFrames | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetchRadarFrames()
      .then((f) => !cancelled && setFrames(f))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);
  return { frames, failed };
}

export function radarTimeLabel(seconds: number): string {
  const d = new Date(seconds * 1000);
  const h = d.getHours();
  return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}${h < 12 ? 'am' : 'pm'}`;
}

/**
 * A still of the latest radar around the user, drawn from map tiles (no map library or WebView,
 * so it's light enough for the For you feed). Taps through to the live radar.
 */
export function RadarPreview({ coords, height = 150, dark }: { coords: Coords; height?: number; dark: boolean }) {
  const { frames } = useRadarFrames();
  const [width, setWidth] = useState(0);
  const latest = frames?.frames[frames.frames.length - 1];

  const z = RADAR_MAX_ZOOM;
  const center = worldPixel(coords.latitude, coords.longitude, z);
  const left = center.x - width / 2;
  const top = center.y - height / 2;
  const tiles: { x: number; y: number }[] = [];
  if (width > 0) {
    const max = 2 ** z;
    for (let ty = Math.floor(top / 256); ty <= Math.floor((top + height) / 256); ty++) {
      for (let tx = Math.floor(left / 256); tx <= Math.floor((left + width) / 256); tx++) {
        if (ty >= 0 && ty < max) tiles.push({ x: tx, y: ty });
      }
    }
  }
  const wrap = (x: number) => ((x % 2 ** z) + 2 ** z) % 2 ** z;

  return (
    <Pressable
      onPress={openRadar}
      onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}
      style={[styles.box, { height, backgroundColor: dark ? '#1B1D22' : '#E8EAED' }]}
      accessibilityRole="button"
      accessibilityLabel="Open weather radar"
    >
      {tiles.map((t) => {
        const pos = { left: t.x * 256 - left, top: t.y * 256 - top, width: 256, height: 256 };
        return (
          <View key={`${t.x}:${t.y}`} style={[styles.tile, pos]}>
            <Image source={{ uri: baseTileUrl(dark, z, wrap(t.x), t.y, cartoKey) }} style={StyleSheet.absoluteFill} />
            {latest && frames ? (
              <Image
                source={{ uri: radarTileUrl(frames.host, latest, z, wrap(t.x), t.y) }}
                style={[StyleSheet.absoluteFill, { opacity: 0.8 }]}
                transition={200}
              />
            ) : null}
          </View>
        );
      })}
      <View style={[styles.dot, { left: width / 2 - 7, top: height / 2 - 7 }]} />
      <View style={styles.label}>
        <Ionicons name="radio-outline" size={13} color="#fff" />
        <Text style={styles.labelText}>{latest ? `Radar · ${radarTimeLabel(latest.time)}` : 'Radar'}</Text>
      </View>
      <Text style={styles.credit}>© CARTO © OpenStreetMap · RainViewer</Text>
      <View style={styles.open}>
        <Ionicons name="expand" size={14} color="#fff" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: 16, overflow: 'hidden' },
  tile: { position: 'absolute' },
  dot: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#2D74D6',
    borderWidth: 2.5,
    borderColor: '#fff',
  },
  label: {
    position: 'absolute',
    left: 8,
    top: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  labelText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  credit: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    fontSize: 9,
    color: '#333',
    backgroundColor: 'rgba(255,255,255,0.7)',
    paddingHorizontal: 4,
    borderTopLeftRadius: 6,
  },
  open: { position: 'absolute', right: 8, top: 8, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999, padding: 5 },
});
