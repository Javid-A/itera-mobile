import { TextStyle } from 'react-native';

export const Typography: Record<string, TextStyle> = {
  h1: { fontSize: 28, fontWeight: '700', letterSpacing: 0.3 },
  h2: { fontSize: 22, fontWeight: '600', letterSpacing: 0.2 },
  h3: { fontSize: 18, fontWeight: '600' },
  body: { fontSize: 16, fontWeight: '400' },
  caption: { fontSize: 13, fontWeight: '400' },
  label: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
} as const;
