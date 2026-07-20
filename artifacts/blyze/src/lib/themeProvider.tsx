import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'dark' | 'light' | 'neon' | 'sunset' | 'ocean' | 'forest' | 'cyberpunk' | 'retro';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  randomTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEMES: Theme[] = ['dark', 'light', 'neon', 'sunset', 'ocean', 'forest', 'cyberpunk', 'retro'];

const THEME_COLORS: Record<Theme, { primary: string; secondary: string; accent: string; bg: string }> = {
  dark: {
    primary: '#1a1a1a',
    secondary: '#2d2d2d',
    accent: '#00d4ff',
    bg: '#0a0a0a'
  },
  light: {
    primary: '#ffffff',
    secondary: '#f5f5f5',
    accent: '#0066cc',
    bg: '#fafafa'
  },
  neon: {
    primary: '#0d0221',
    secondary: '#3a0ca3',
    accent: '#fb5607',
    bg: '#000000'
  },
  sunset: {
    primary: '#ff6b35',
    secondary: '#f7931e',
    accent: '#fdb833',
    bg: '#1a1a1a'
  },
  ocean: {
    primary: '#0077b6',
    secondary: '#00b4d8',
    accent: '#90e0ef',
    bg: '#03045e'
  },
  forest: {
    primary: '#1b4332',
    secondary: '#2d6a4f',
    accent: '#52b788',
    bg: '#0b3d2c'
  },
  cyberpunk: {
    primary: '#ff006e',
    secondary: '#8338ec',
    accent: '#3a86ff',
    bg: '#0a0e27'
  },
  retro: {
    primary: '#ffd60a',
    secondary: '#ffc300',
    accent: '#ff006e',
    bg: '#2a2a2a'
  }
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem('kryv-theme');
    return (saved as Theme) || 'dark';
  });

  const applyTheme = (newTheme: Theme) => {
    const colors = THEME_COLORS[newTheme];
    const root = document.documentElement;
    
    root.style.setProperty('--color-primary', colors.primary);
    root.style.setProperty('--color-secondary', colors.secondary);
    root.style.setProperty('--color-accent', colors.accent);
    root.style.setProperty('--color-bg', colors.bg);
    
    root.classList.remove(...THEMES.map(t => `theme-${t}`));
    root.classList.add(`theme-${newTheme}`);
    
    localStorage.setItem('kryv-theme', newTheme);
    setThemeState(newTheme);
  };

  const randomTheme = () => {
    const randomIndex = Math.floor(Math.random() * THEMES.length);
    applyTheme(THEMES[randomIndex]);
  };

  useEffect(() => {
    applyTheme(theme);
  }, []);

  // Auto-change theme on click anywhere on the page
  useEffect(() => {
    const handleClick = () => {
      randomTheme();
    };

    // Attach to document with a slight delay to avoid interfering with actual clicks
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClick, { capture: true });
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClick, { capture: true });
    };
  }, []);

  // Auto-change theme on page reload
  useEffect(() => {
    randomTheme();
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme: applyTheme, randomTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
