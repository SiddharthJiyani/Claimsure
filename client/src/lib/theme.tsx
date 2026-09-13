"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export const THEME_STORAGE_KEY = "claimsure-theme";
export type Theme = "light" | "dark";

type ThemeState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeState | null>(null);

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    const next: Theme = stored === "light" ? "light" : "dark";
    setThemeState(next);
    applyTheme(next);
  }, []);

  const value = useMemo<ThemeState>(
    () => ({
      theme,
      setTheme: (next) => {
        setThemeState(next);
        window.localStorage.setItem(THEME_STORAGE_KEY, next);
        applyTheme(next);
      },
      toggleTheme: () => {
        const next: Theme = theme === "dark" ? "light" : "dark";
        setThemeState(next);
        window.localStorage.setItem(THEME_STORAGE_KEY, next);
        applyTheme(next);
      },
    }),
    [theme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
