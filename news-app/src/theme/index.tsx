import { Platform, useColorScheme } from 'react-native';

import { useSettings } from '../state/SettingsContext';

export interface Palette {
  dark: boolean;
  background: string;
  card: string;
  elevated: string;
  text: string;
  secondary: string;
  tertiary: string;
  separator: string;
  /** Hammer orange: only for live things, breaking news and the main action on a screen. */
  accent: string;
  /** Text and icons on an accent background. */
  onAccent: string;
  /** Accent as text on the page (darker in light mode so it stays readable). */
  accentText: string;
  /** Hairline border around cards. */
  border: string;
  chip: string;
  chipText: string;
  chipActive: string;
  chipActiveText: string;
  tabBar: string;
  skeleton: string;
  up: string;
  down: string;
}

export const HAMMER = '#FF5A1F';
const ON_HAMMER = '#120600';

// Design system v2: dark first. Ink page, slightly lifted surfaces, hairline borders, one orange.
const dark: Palette = {
  dark: true,
  background: '#0B0B0D',
  card: '#151518',
  elevated: '#1E1E23',
  text: '#F5F5F7',
  secondary: '#B4B4BC',
  tertiary: '#8A8A93',
  separator: '#2A2A31',
  accent: HAMMER,
  onAccent: ON_HAMMER,
  accentText: '#FF7440',
  border: '#2A2A31',
  chip: '#1E1E23',
  chipText: '#D4D4DA',
  chipActive: '#F5F5F7',
  chipActiveText: '#0B0B0D',
  tabBar: 'rgba(11,11,13,0.97)',
  skeleton: '#232329',
  up: '#3FD07A',
  down: '#FF5C5C',
};

const light: Palette = {
  dark: false,
  background: '#F5F5F7',
  card: '#FFFFFF',
  elevated: '#FFFFFF',
  text: '#0B0B0D',
  secondary: '#45454D',
  tertiary: '#6E6E76',
  separator: '#E2E2E7',
  accent: HAMMER,
  onAccent: ON_HAMMER,
  accentText: '#C2410C',
  border: '#E2E2E7',
  chip: '#FFFFFF',
  chipText: '#2A2A31',
  chipActive: '#0B0B0D',
  chipActiveText: '#FFFFFF',
  tabBar: 'rgba(255,255,255,0.97)',
  skeleton: '#E6E6EB',
  up: '#12A150',
  down: '#E5383B',
};

/** The active palette: dark unless the user picked light (or "match phone") in Settings. */
export function useTheme(): Palette {
  const system = useColorScheme();
  const { themeMode } = useSettings();
  const mode = themeMode === 'system' ? (system === 'light' ? 'light' : 'dark') : themeMode;
  return mode === 'dark' ? dark : light;
}

/**
 * Barlow Condensed, bundled with the app (expo-font plugin). Each weight is its own family, so
 * styles using these set no fontWeight (Android would otherwise fake-bold or fall back).
 */
export const fonts = {
  display: 'BarlowCondensed_900Black',
  heading: 'BarlowCondensed_800ExtraBold',
  bold: 'BarlowCondensed_700Bold',
};

/** Kept for older call sites: the headline face. */
export const headlineFont = fonts.heading;

export const type = {
  /** Screen titles: "TODAY", "EXPLORE". */
  largeTitle: { fontFamily: fonts.display, fontSize: 40, lineHeight: 42, textTransform: 'uppercase' as const, letterSpacing: -0.3 },
  /** Section titles: "TOP STORIES". */
  sectionTitle: { fontFamily: fonts.heading, fontSize: 25, lineHeight: 28, textTransform: 'uppercase' as const, letterSpacing: 0.2 },
  /** Big story headlines on image cards and the top story. */
  heroTitle: { fontFamily: fonts.heading, fontSize: 29, lineHeight: 30, letterSpacing: -0.2 },
  title: { fontSize: 19, fontWeight: '800' as const, lineHeight: 24 },
  rowTitle: { fontSize: 16.5, fontWeight: '700' as const, lineHeight: 22 },
  body: { fontSize: 15, lineHeight: 21 },
  meta: { fontSize: 13, fontWeight: '800' as const },
  caption: { fontSize: 13 },
  /** Small caps label above things: "YOUR BRIEFING". */
  eyebrow: { fontSize: 11, fontWeight: '800' as const, letterSpacing: 1.4, textTransform: 'uppercase' as const },
  /** Big numbers: temperatures, scores, prices. */
  number: { fontFamily: fonts.display },
};

/** Default headline font on Android before the app font was added; still used where no custom font fits. */
export const systemCondensed = Platform.select({ android: 'sans-serif-condensed', default: undefined });
