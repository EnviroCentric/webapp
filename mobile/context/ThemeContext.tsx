import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useColorScheme } from '@/hooks/use-color-scheme';

export type ThemePreference = 'system' | 'light' | 'dark';

export type AppTheme = 'light' | 'dark';

type ThemeContextValue = {
  preference: ThemePreference;
  setPreference: (pref: ThemePreference) => void;
  effectiveTheme: AppTheme;
  isDarkMode: boolean;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = 'theme-preference';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme() ?? 'light';
  const [preference, setPreference] = useState<ThemePreference>('system');
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setPreference(stored);
        }
      } catch {
        // ignore storage errors and fall back to system
      } finally {
        setIsHydrated(true);
      }
    })();
  }, []);

  const effectiveTheme: AppTheme =
    preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;

  const handleSetPreference = async (pref: ThemePreference) => {
    setPreference(pref);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, pref);
    } catch {
      // ignore storage errors
    }
  };

  // Until we've loaded the stored preference, stick with system behavior
  if (!isHydrated) {
    return null;
  }

  return (
    <ThemeContext.Provider
      value={{
        preference,
        setPreference: handleSetPreference,
        effectiveTheme,
        isDarkMode: effectiveTheme === 'dark',
      }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useAppTheme must be used within a ThemeProvider');
  }
  return ctx;
}