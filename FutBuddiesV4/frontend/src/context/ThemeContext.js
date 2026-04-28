// ============================================================
//  FutBuddies - Contexto de Tema (Escuro / Claro)
// ============================================================

import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [tema, setTema] = useState(() => localStorage.getItem('tema') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tema);
    localStorage.setItem('tema', tema);
  }, [tema]);

  const toggleTema = () => setTema(t => t === 'dark' ? 'light' : 'dark');

  return (
    <ThemeContext.Provider value={{ tema, toggleTema, isDark: tema === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
