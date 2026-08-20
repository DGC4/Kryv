import { create } from 'zustand';

export type Theme = 'cyan' | 'pink' | 'green' | 'purple' | 'orange';
export type ThemePreference = 'auto' | 'locked';

export const THEMES: Theme[] = ['cyan', 'pink', 'green', 'purple', 'orange'];
const THEME_STORAGE_KEY = 'kryv-theme';
const THEME_PREFERENCE_STORAGE_KEY = 'kryv-theme-preference';

// Theme values are device-local presentation preferences only. They must never
// be repurposed for session, profile, entitlement, or identity state.
function readThemeStorage(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeThemeStorage(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Browser privacy controls may block storage. The current in-memory theme
    // remains available without changing any authorization state.
  }
}

function resolveInitialTheme(): Theme {
  const stored = readThemeStorage(THEME_STORAGE_KEY);
  return THEMES.includes(stored as Theme) ? (stored as Theme) : 'cyan';
}

function resolveInitialPreference(): ThemePreference {
  return readThemeStorage(THEME_PREFERENCE_STORAGE_KEY) === 'locked' ? 'locked' : 'auto';
}

export function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.classList.add('dark');
  writeThemeStorage(THEME_STORAGE_KEY, theme);
}

function persistPreference(preference: ThemePreference) {
  writeThemeStorage(THEME_PREFERENCE_STORAGE_KEY, preference);
}

function nextTheme(theme: Theme): Theme {
  const currentIndex = THEMES.indexOf(theme);
  return THEMES[(currentIndex + 1) % THEMES.length];
}

interface ThemeStore {
  theme: Theme;
  preference: ThemePreference;
  cycleTheme: () => void;
  setTheme: (theme: Theme) => void;
  setPreference: (preference: ThemePreference) => void;
  advanceForNavigation: () => void;
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: resolveInitialTheme(),
  preference: resolveInitialPreference(),
  // The visible header palette always remains a direct manual control. A
  // manual choice updates the starting accent for the next automatic route
  // advance, rather than silently changing the user's Auto/Locked setting.
  cycleTheme: () => {
    const theme = nextTheme(get().theme);
    set({ theme });
    applyTheme(theme);
  },
  setTheme: (theme) => {
    set({ theme });
    applyTheme(theme);
  },
  setPreference: (preference) => {
    set({ preference });
    persistPreference(preference);
  },
  advanceForNavigation: () => {
    if (get().preference === 'locked') return;
    const theme = nextTheme(get().theme);
    set({ theme });
    applyTheme(theme);
  },
}));

if (typeof document !== 'undefined') applyTheme(resolveInitialTheme());
