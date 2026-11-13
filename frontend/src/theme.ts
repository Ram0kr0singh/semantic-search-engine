import { useCallback, useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'theme';

export function getStoredTheme(): Theme | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (value === 'dark' || value === 'light') {
      return value;
    }
  } catch {
    // Gracefully ignore blocked or failing storage access
  }
  return null;
}

export function setStoredTheme(theme: Theme): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    }
  } catch {
    // Gracefully ignore blocked storage
  }
}

export function getSystemTheme(): Theme {
  try {
    if (typeof window !== 'undefined' && window.matchMedia) {
      if (window.matchMedia('(prefers-color-scheme: light)').matches) {
        return 'light';
      }
    }
  } catch {
    // Fall back to dark
  }
  return 'dark';
}

export function resolveInitialTheme(): Theme {
  return getStoredTheme() ?? getSystemTheme();
}

export function applyTheme(theme: Theme): void {
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
  }
}

export function useTheme(): {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
} {
  const [theme, setThemeState] = useState<Theme>(resolveInitialTheme);

  const setTheme = useCallback((nextTheme: Theme) => {
    setThemeState(nextTheme);
    setStoredTheme(nextTheme);
    applyTheme(nextTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const next = current === 'dark' ? 'light' : 'dark';
      setStoredTheme(next);
      applyTheme(next);
      return next;
    });
  }, []);

  useEffect(() => {
    // Ensure document reflects current theme on mount
    applyTheme(theme);

    if (typeof window === 'undefined' || !window.matchMedia) return;

    try {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
      const handleChange = (e: MediaQueryListEvent) => {
        // Only react to system preference changes if no explicit user choice is stored
        if (!getStoredTheme()) {
          const next = e.matches ? 'light' : 'dark';
          setThemeState(next);
          applyTheme(next);
        }
      };

      if (typeof mediaQuery.addEventListener === 'function') {
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
      } else if (typeof mediaQuery.addListener === 'function') {
        mediaQuery.addListener(handleChange);
        return () => mediaQuery.removeListener(handleChange);
      }
    } catch {
      // Ignore matchMedia listener issues
    }
  }, [theme]);

  return {
    theme,
    isDark: theme === 'dark',
    toggleTheme,
    setTheme,
  };
}
