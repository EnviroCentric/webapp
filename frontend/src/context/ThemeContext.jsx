import React, { createContext, useContext, useEffect } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const isDarkMode = true;

  useEffect(() => {
    localStorage.setItem('theme', 'dark');
    const root = document.documentElement;
    root.classList.add('dark');
  }, []);

  const toggleTheme = () => {};

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
      <div className="transition-colors duration-200">
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
