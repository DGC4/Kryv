import { create } from 'zustand';

type Theme = 'cyan' | 'pink' | 'green' | 'purple' | 'orange';
const THEMES: Theme[] = ['cyan', 'pink', 'green', 'purple', 'orange'];

interface ThemeStore {
  theme: Theme;
  cycleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: 'cyan',
  cycleTheme: () => {
    const currentTheme = get().theme;
    const currentIndex = THEMES.indexOf(currentTheme);
    const nextIndex = (currentIndex + 1) % THEMES.length;
    const nextTheme = THEMES[nextIndex];
    set({ theme: nextTheme });
    document.documentElement.setAttribute('data-theme', nextTheme);
  },
  setTheme: (theme) => {
    set({ theme });
    document.documentElement.setAttribute('data-theme', theme);
  }
}));

// Setup initial theme
if (typeof document !== 'undefined') {
  document.documentElement.setAttribute('data-theme', 'cyan');
  document.documentElement.classList.add('dark');
}
