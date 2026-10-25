import { useColorScheme } from 'react-native';

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
  skeleton: string;
}

const light: Palette = {
  dark: false,
  background: '#F2F2F7',
  card: '#FFFFFF',
  elevated: '#FFFFFF',
  text: '#0B0B0F',
  secondary: '#5E5E66',
  tertiary: '#8E8E93',
  separator: 'rgba(60,60,67,0.18)',
  accent: '#FA243C',
  chip: '#E5E5EA',
  chipText: '#1C1C1E',
  skeleton: '#E3E3E8',
};

const dark: Palette = {
  dark: true,
  background: '#000000',
  card: '#1C1C1E',
  elevated: '#2C2C2E',
  text: '#F5F5F7',
  secondary: '#AEAEB2',
  tertiary: '#8E8E93',
  separator: 'rgba(84,84,88,0.5)',
  accent: '#FF375F',
  chip: '#2C2C2E',
  chipText: '#F2F2F7',
  skeleton: '#2A2A2D',
};

/** The active palette: the phone's light/dark setting unless the user picked one in Settings. */
export function useTheme(): Palette {
  const system = useColorScheme();
  const { themeMode } = useSettings();
  const mode = themeMode === 'system' ? (system === 'dark' ? 'dark' : 'light') : themeMode;
  return mode === 'dark' ? dark : light;
}

export const type = {
  largeTitle: { fontSize: 34, fontWeight: '800' as const, letterSpacing: -0.6 },
  heroTitle: { fontSize: 26, fontWeight: '800' as const, letterSpacing: -0.4, lineHeight: 31 },
  title: { fontSize: 20, fontWeight: '700' as const, letterSpacing: -0.2, lineHeight: 25 },
  body: { fontSize: 15, lineHeight: 21 },
  meta: { fontSize: 13, fontWeight: '600' as const },
  caption: { fontSize: 13 },
};
