export type ColorScheme = {
  background: string;
  surface: string;
  surface2: string;
  surface3: string;
  accent: string;
  accentDim: string;
  accentSoft: string;
  accentBorder: string;
  orange: string;
  orangeDim: string;
  orangeBorder: string;
  orangeSubtle: string;
  blue: string;
  textPrimary: string;
  textSecondary: string;
  muted: string;
  border: string;
  borderBright: string;
  success: string;
  danger: string;
  tabBarBackground: string;
};

export const DarkColors: ColorScheme = {
  background: '#07080f',
  surface: '#0d1120',
  surface2: '#131928',
  surface3: '#1c2440',
  accent: '#25ff8f',
  accentDim: 'rgba(166, 230, 53, 0.22)',
  accentSoft: 'rgba(166, 230, 53, 0.12)',
  accentBorder: 'rgba(166, 230, 53, 0.55)',
  orange: '#ffa500',
  orangeDim: 'rgba(249, 115, 22, 0.18)',
  orangeBorder: 'rgba(249, 115, 22, 0.4)',
  orangeSubtle: 'rgba(249, 115, 22, 0.12)',
  blue: '#4f8ef7',
  textPrimary: '#edf2fb',
  textSecondary: '#7a8fb8',
  muted: '#2e3a56',
  border: 'rgba(255, 255, 255, 0.07)',
  borderBright: 'rgba(255, 255, 255, 0.13)',
  success: '#22c55e',
  danger: '#ef4444',
  tabBarBackground: 'rgba(7, 8, 15, 0.96)',
};

// Haze D — lavender-tinted whites
export const LightColors: ColorScheme = {
  background: '#eff0ff',
  surface: '#e5e7ff',
  surface2: '#d8dbff',
  surface3: '#c8ccf5',
  accent: '#16c26a',
  accentDim: 'rgba(22, 194, 106, 0.20)',
  accentSoft: 'rgba(22, 194, 106, 0.10)',
  accentBorder: 'rgba(22, 194, 106, 0.55)',
  orange: '#f06000',
  orangeDim: 'rgba(240, 96, 0, 0.16)',
  orangeBorder: 'rgba(240, 96, 0, 0.45)',
  orangeSubtle: 'rgba(240, 96, 0, 0.10)',
  blue: '#2060ff',
  textPrimary: '#0e0f2a',
  textSecondary: '#404880',
  muted: '#8890c0',
  border: 'rgba(14, 15, 42, 0.08)',
  borderBright: 'rgba(14, 15, 42, 0.14)',
  success: '#15a058',
  danger: '#dc2626',
  tabBarBackground: 'rgba(239, 240, 255, 0.96)',
};

// Backward-compatible default (dark)
export const Colors = DarkColors;
