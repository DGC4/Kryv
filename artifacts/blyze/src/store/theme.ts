import { create } from 'zustand';

type Theme = 'cyan' | 'pink' | 'green' | 'purple' | 'orange';
const THEMES: Theme[] = ['cyan', 'pink', 'green', 'purple', 'orange'];
const THEME_STORAGE_KEY = 'kryv-theme';

function resolveInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'cyan';
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return THEMES.includes(stored as Theme) ? stored as Theme : 'cyan';
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.classList.add('dark');
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
}

interface ThemeStore {
  theme: Theme;
  cycleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: resolveInitialTheme(),
  cycleTheme: () => {
    const currentIndex = THEMES.indexOf(get().theme);
    const nextTheme = THEMES[(currentIndex + 1) % THEMES.length];
    set({ theme: nextTheme });
    applyTheme(nextTheme);
  },
  setTheme: (theme) => {
    set({ theme });
    applyTheme(theme);
  },
}));

if (typeof document !== 'undefined') applyTheme(resolveInitialTheme());
