import React, { createContext, useContext } from 'react';

// Theme is managed by store/theme.ts (zustand + data-theme on :root).
// This provider is kept as a lightweight context shell for compatibility.

interface ThemeContextType {
  dummy: true;
}

const ThemeContext = createContext<ThemeContextType>({ dummy: true });

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <ThemeContext.Provider value={{ dummy: true }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
