export const Colors = {
  // Surfaces
  background: '#07080f',
  surface: '#0d1120',
  surface2: '#131928',
  surface3: '#1c2440',

  // Accent (primary = lime; legacy orange kept for warning/geofence glow)
  accent: '#a6e635',
  accentDim: 'rgba(166, 230, 53, 0.22)',
  accentSoft: 'rgba(166, 230, 53, 0.12)',
  orange: '#f97316',
  orangeDim: 'rgba(249, 115, 22, 0.18)',
  blue: '#4f8ef7',

  // Text
  textPrimary: '#edf2fb',
  textSecondary: '#7a8fb8',
  muted: '#2e3a56',

  // Borders
  border: 'rgba(255, 255, 255, 0.07)',
  borderBright: 'rgba(255, 255, 255, 0.13)',

  // Status
  success: '#22c55e',
  danger: '#ef4444',
} as const;
