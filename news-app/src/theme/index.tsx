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
  accent: string;
  chip: string;
  chipText: string;
  chipActive: string;
  chipActiveText: string;
  tabBar: string;
  skeleton: string;
}

// Samsung News-style: flat white cards on a light grey page, black active pills, brand red accents.
const light: Palette = {
  dark: false,
  background: '#F0F0F3',
  card: '#FFFFFF',
  elevated: '#FFFFFF',
  text: '#111114',
  secondary: '#4A4A50',
  tertiary: '#86868C',
  separator: 'rgba(60,60,67,0.14)',
  accent: '#E3141B',
  chip: '#FFFFFF',
  chipText: '#111114',
  chipActive: '#111114',
  chipActiveText: '#FFFFFF',
  tabBar: 'rgba(236,236,240,0.97)',
  skeleton: '#E4E4E8',
};

const dark: Palette = {
  dark: true,
  background: '#000000',
  card: '#17171A',
  elevated: '#252529',
  text: '#F4F4F6',
  secondary: '#B4B4BA',
  tertiary: '#8A8A90',
  separator: 'rgba(84,84,88,0.45)',
  accent: '#FF3B40',
  chip: '#1E1E22',
  chipText: '#F2F2F4',
  chipActive: '#F4F4F6',
  chipActiveText: '#000000',
  tabBar: 'rgba(36,36,40,0.97)',
  skeleton: '#26262A',
};

/** The active palette: the phone's light/dark setting unless the user picked one in Settings. */
export function useTheme(): Palette {
  const system = useColorScheme();
  const { themeMode } = useSettings();
  const mode = themeMode === 'system' ? (system === 'dark' ? 'dark' : 'light') : themeMode;
  return mode === 'dark' ? dark : light;
}

/** Condensed bold headlines, like Samsung News. Android ships Roboto Condensed as sans-serif-condensed. */
export const headlineFont = Platform.select({ android: 'sans-serif-condensed', default: undefined });

export const type = {
  largeTitle: { fontSize: 30, fontWeight: '800' as const, letterSpacing: -0.4 },
  sectionTitle: { fontSize: 26, fontWeight: '800' as const, letterSpacing: -0.3 },
  heroTitle: { fontSize: 24, fontWeight: '700' as const, lineHeight: 29, fontFamily: headlineFont },
  title: { fontSize: 19, fontWeight: '700' as const, lineHeight: 24, fontFamily: headlineFont },
  rowTitle: { fontSize: 17, fontWeight: '700' as const, lineHeight: 22, fontFamily: headlineFont },
  body: { fontSize: 15, lineHeight: 21 },
  meta: { fontSize: 13, fontWeight: '800' as const },
  caption: { fontSize: 13 },
};
