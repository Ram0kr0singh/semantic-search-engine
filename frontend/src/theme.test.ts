import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  applyTheme,
  getStoredTheme,
  getSystemTheme,
  resolveInitialTheme,
  setStoredTheme,
  THEME_STORAGE_KEY,
  useTheme,
} from './theme';

describe('Theme System (B2)', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.colorScheme = '';
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('resolves initial theme from a stored value', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    expect(getStoredTheme()).toBe('light');
    expect(resolveInitialTheme()).toBe('light');

    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    expect(getStoredTheme()).toBe('dark');
    expect(resolveInitialTheme()).toBe('dark');
  });

  it('resolves initial theme from system preference when no stored value exists', () => {
    // Mock window.matchMedia for light preference
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('light'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    expect(getStoredTheme()).toBeNull();
    expect(getSystemTheme()).toBe('light');
    expect(resolveInitialTheme()).toBe('light');

    // Mock window.matchMedia for dark preference
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: !query.includes('light'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    expect(getSystemTheme()).toBe('dark');
    expect(resolveInitialTheme()).toBe('dark');
  });

  it('stored value overrides the system preference', () => {
    // System prefers dark, but user explicitly stored 'light'
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: !query.includes('light'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    expect(getStoredTheme()).toBe('light');
    expect(getSystemTheme()).toBe('dark');
    expect(resolveInitialTheme()).toBe('light');
  });

  it('toggle changes data-theme and colorScheme on document element and persists to localStorage', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');

    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe('dark');
    expect(result.current.isDark).toBe(true);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');

    act(() => {
      result.current.toggleTheme();
    });

    expect(result.current.theme).toBe('light');
    expect(result.current.isDark).toBe(false);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.style.colorScheme).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');

    act(() => {
      result.current.toggleTheme();
    });

    expect(result.current.theme).toBe('dark');
    expect(result.current.isDark).toBe(true);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('gracefully handles blocked localStorage without crashing', () => {
    const storageSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    });
    const setStorageSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    });

    // Getting stored theme does not throw
    expect(() => getStoredTheme()).not.toThrow();
    expect(getStoredTheme()).toBeNull();

    // Setting stored theme does not throw
    expect(() => setStoredTheme('light')).not.toThrow();

    // useTheme hook functions normally
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBeDefined();

    expect(() => {
      act(() => {
        result.current.toggleTheme();
      });
    }).not.toThrow();

    storageSpy.mockRestore();
    setStorageSpy.mockRestore();
  });

  it('applyTheme directly updates data-theme and color-scheme', () => {
    applyTheme('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.style.colorScheme).toBe('light');

    applyTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });
});
