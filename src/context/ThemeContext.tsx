import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ColorScheme, DarkColors, LightColors } from '../constants/colors';
import { TIER_COLORS_DARK, TIER_COLORS_LIGHT } from '../config/tierConfig';

const THEME_KEY = 'app_theme';

interface ThemeContextValue {
  isDark: boolean;
  colors: ColorScheme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  isDark: false,
  colors: LightColors,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((val) => {
      if (val === 'dark') setIsDark(true);
      // no saved value → stay light (default)
    });
  }, []);

  const toggleTheme = useCallback(async () => {
    const next = !isDark;
    setIsDark(next);
    await AsyncStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
  }, [isDark]);

  const value = useMemo(
    () => ({ isDark, colors: isDark ? DarkColors : LightColors, toggleTheme }),
    [isDark, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function useTierColors() {
  const { isDark } = useTheme();
  return isDark ? TIER_COLORS_DARK : TIER_COLORS_LIGHT;
}
