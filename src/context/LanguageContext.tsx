import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../i18n';

const LANGUAGE_KEY = 'app_language';

export const AVAILABLE_LANGUAGES = [
  { code: 'en', label: 'English' },
] as const;

export type LanguageCode = (typeof AVAILABLE_LANGUAGES)[number]['code'];

interface LanguageContextValue {
  language: LanguageCode;
  changeLanguage: (code: LanguageCode) => Promise<void>;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: 'en',
  changeLanguage: async () => {},
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<LanguageCode>('en');

  useEffect(() => {
    AsyncStorage.getItem(LANGUAGE_KEY).then((saved) => {
      const valid = AVAILABLE_LANGUAGES.find((l) => l.code === saved);
      if (valid) {
        setLanguage(valid.code);
        i18n.changeLanguage(valid.code);
      }
    });
  }, []);

  const changeLanguage = useCallback(async (code: LanguageCode) => {
    setLanguage(code);
    await i18n.changeLanguage(code);
    await AsyncStorage.setItem(LANGUAGE_KEY, code);
  }, []);

  const value = useMemo(() => ({ language, changeLanguage }), [language, changeLanguage]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}
