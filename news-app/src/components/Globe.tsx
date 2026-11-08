import { useIsFocused } from '@react-navigation/native';
import { useEffect, useMemo, useState } from 'react';
import Svg, { Circle, Defs, G, Polyline, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';

import { project, type Hotspot } from '../services/pulse';
import { HAMMER } from '../theme';

const PIN_COLORS = [HAMMER, '#5CC8FF', '#FFC53D', '#A78BFA', '#3FD07A', '#F472B6'];
const FRAME_MS = 50;
const DEG_PER_FRAME = 0.35;

/** Line segments of the parts of a lat/lon path on the near side of the globe. */
function visibleSegments(points: [number, number][], lon0: number, cx: number, cy: number, r: number): string[] {
  const segments: string[] = [];
  let current: string[] = [];
  for (const [lat, lon] of points) {
    const p = project(lat, lon, lon0);
    if (p.visible) current.push(`${(cx + p.x * r).toFixed(1)},${(cy + p.y * r).toFixed(1)}`);
    else if (current.length) {
      if (current.length > 1) segments.push(current.join(' '));
      current = [];
    }
  }
  if (current.length > 1) segments.push(current.join(' '));
  return segments;
}

const range = (from: number, to: number, step: number) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);
const MERIDIANS = range(-180, 150, 30).map((lon) => range(-90, 90, 6).map((lat) => [lat, lon] as [number, number]));
const PARALLELS = [-60, -30, 0, 30, 60].map((lat) => range(-180, 180, 6).map((lon) => [lat, lon] as [number, number]));

/**
 * A slowly turning globe with a glowing pin wherever the news is, sized by how many stories mention
 * the place. Turns only while its screen is on top, and starts facing the busiest place.
 */
export function Globe({ size, spots, labels = 3, spin = true }: { size: number; spots: Hotspot[]; labels?: number; spin?: boolean }) {
  const focused = useIsFocused();
  const start = spots[0]?.place.lon ?? -40;
  const [lon0, setLon0] = useState(start);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!spin || !focused) return;
    const timer = setInterval(() => {
      setLon0((l) => (l + DEG_PER_FRAME) % 360);
      setTick((t) => t + 1);
    }, FRAME_MS);
    return () => clearInterval(timer);
  }, [spin, focused]);

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 6;
  const grid = useMemo(
    () => [...MERIDIANS, ...PARALLELS].flatMap((line) => visibleSegments(line, lon0, cx, cy, r)),
    [lon0, cx, cy, r],
  );
  const max = Math.max(1, ...spots.map((s) => s.stories.length));
  const pins = spots
    .slice(0, 14)
    .map((s, i) => ({ s, i, p: project(s.place.lat, s.place.lon, lon0) }))
    .filter(({ p }) => p.visible);
  const pulse = (tick % 40) / 40;

  return (
    <Svg width={size} height={size} accessibilityLabel={`Globe showing news from ${spots.slice(0, 3).map((s) => s.place.name).join(', ')}`}>
      <Defs>
        <RadialGradient id="sphere" cx="38%" cy="32%" r="75%">
          <Stop offset="0" stopColor="#1D2A47" />
          <Stop offset="1" stopColor="#0A0E18" />
        </RadialGradient>
      </Defs>
      <Circle cx={cx} cy={cy} r={r} fill="url(#sphere)" stroke="#2A3550" strokeWidth={1} />
      <G>
        {grid.map((pts, i) => (
          <Polyline key={i} points={pts} fill="none" stroke="#24314F" strokeWidth={1} />
        ))}
      </G>
      {pins.map(({ s, i, p }) => {
        const x = cx + p.x * r;
        const y = cy + p.y * r;
        const color = PIN_COLORS[i % PIN_COLORS.length]!;
        const dot = 3 + 4 * (s.stories.length / max);
        return (
          <G key={s.place.id}>
            {i < 6 ? <Circle cx={x} cy={y} r={dot + pulse * 16} fill={color} opacity={0.45 * (1 - pulse)} /> : null}
            <Circle cx={x} cy={y} r={dot} fill={color} />
          </G>
        );
      })}
      {pins
        .filter(({ i }) => i < labels)
        // Skip a label that would sit on top of a busier place's label.
        .filter(({ p }, k, all) => all.slice(0, k).every((o) => Math.abs((o.p.y - p.y) * r) > 26 || Math.abs((o.p.x - p.x) * r) > 120))
        .map(({ s, p }) => {
          const x = cx + p.x * r;
          const y = cy + p.y * r;
          const text = `${s.place.name} · ${s.stories.length}`;
          const w = text.length * 6.6 + 16;
          const left = Math.min(Math.max(4, x + 10), size - w - 4);
          return (
            <G key={`l-${s.place.id}`}>
              <Rect x={left} y={y - 11} width={w} height={22} rx={11} fill="#11151F" stroke="#2A3550" />
              <SvgText x={left + 8} y={y + 4} fill="#F2F4F8" fontSize={11} fontWeight="700" fontFamily="sans-serif">
                {text}
              </SvgText>
            </G>
          );
        })}
    </Svg>
  );
}
