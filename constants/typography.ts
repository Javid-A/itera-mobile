import { TextStyle } from 'react-native';

// Rajdhani — display / headings / numeric stats
// Inter — body / UI text
export const Fonts = {
  display: 'Rajdhani_700Bold',
  displayBlack: 'Rajdhani_700Bold',
  displayHeavy: 'Rajdhani_700Bold',
  displayBold: 'Rajdhani_600SemiBold',
  displayMedium: 'Rajdhani_500Medium',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
} as const;

// Rajdhani_900Black is loaded separately; type-safe name used below.
export const DisplayBlack = 'Rajdhani_700Bold';

export const Typography: Record<string, TextStyle> = {
  // Display (Rajdhani) — titles, numbers, CTAs
  displayXL: { fontFamily: 'Rajdhani_700Bold', fontSize: 36, letterSpacing: -0.5, lineHeight: 40 },
  displayLG: { fontFamily: 'Rajdhani_700Bold', fontSize: 30, letterSpacing: -0.3, lineHeight: 34 },
  displayMD: { fontFamily: 'Rajdhani_700Bold', fontSize: 22, letterSpacing: 0, lineHeight: 26 },
  displaySM: { fontFamily: 'Rajdhani_700Bold', fontSize: 18, letterSpacing: 0.3 },

  // Button / CTA — Rajdhani bold, uppercase
  cta: { fontFamily: 'Rajdhani_700Bold', fontSize: 17, letterSpacing: 1, textTransform: 'uppercase' },

  // Stat numbers — Rajdhani heavy
  statXL: { fontFamily: 'Rajdhani_700Bold', fontSize: 32, letterSpacing: -0.5 },
  statLG: { fontFamily: 'Rajdhani_700Bold', fontSize: 26, letterSpacing: -0.3 },
  statMD: { fontFamily: 'Rajdhani_700Bold', fontSize: 20 },
  statSM: { fontFamily: 'Rajdhani_600SemiBold', fontSize: 15 },

  // Body (Inter)
  body: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 },
  bodyMedium: { fontFamily: 'Inter_500Medium', fontSize: 14, lineHeight: 20 },
  bodyLg: { fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16 },
  captionMedium: { fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 16 },

  // Tiny section labels — Rajdhani uppercase with tracking
  label: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  // Legacy aliases kept while older screens transition
  h1: { fontFamily: 'Rajdhani_700Bold', fontSize: 30, letterSpacing: -0.3 },
  h2: { fontFamily: 'Rajdhani_700Bold', fontSize: 22 },
  h3: { fontFamily: 'Rajdhani_700Bold', fontSize: 18 },
} as const;
