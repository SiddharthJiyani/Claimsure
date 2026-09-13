"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export const THEME_STORAGE_KEY = "claimsure-theme";
export type Theme = "light" | "dark";

const THEME_COLORS: Record<Theme, string> = {
  light: "#f4f7fb",
  dark: "#070b12",
};

type ThemeState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeState | null>(null);

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  root.classList.toggle("dark", theme === "dark");
  root.classList.toggle("light", theme === "light");
  if (document.body) {
    document.body.dataset.theme = theme;
  }

  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", THEME_COLORS[theme]);
}

function readStoredTheme(): Theme {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) === "light"
      ? "light"
      : "dark";
  } catch {
    return "dark";
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    const next = readStoredTheme();
    setThemeState(next);
    applyTheme(next);

    function onStorage(event: StorageEvent) {
      if (event.key !== THEME_STORAGE_KEY) return;
      const synced: Theme = event.newValue === "light" ? "light" : "dark";
      setThemeState(synced);
      applyTheme(synced);
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
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
