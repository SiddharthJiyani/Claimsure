"use client";

import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";

export const THEME_STORAGE_KEY = "claimsure-theme";
export type Theme = "light" | "dark";

const THEME_COLORS: Record<Theme, string> = {
  light: "#f3f6fb",
  dark: "#070b12",
};

const THEME_VARS: Record<Theme, Record<string, string>> = {
  light: {
    "--cs-bg": "#f3f6fb",
    "--cs-fg": "#102033",
    "--cs-surface": "#ffffff",
    "--cs-surface-2": "#e8eef6",
    "--cs-sidebar": "#ffffff",
    "--cs-header": "#fffffff0",
    "--cs-border": "#d0dae8",
    "--cs-muted": "#4b5d73",
    "--cs-accent": "#0c8a7e",
    "--cs-accent-2": "#2563eb",
    "--cs-accent-ink": "#04201c",
    "--cs-danger": "#dc2656",
    "--cs-warn": "#c2410c",
    "--cs-success": "#047857",
    "--cs-overlay": "rgb(16 32 51 / 0.35)",
    "--cs-placeholder": "#7b8ea3",
    "--cs-code": "#eef3f8",
    "--cs-ring": "rgb(12 138 126 / 0.28)",
    "--cs-shadow-panel":
      "0 1px 2px rgb(16 32 51 / 0.05), 0 14px 32px -20px rgb(16 32 51 / 0.18)",
    "--cs-shadow-popover": "0 18px 44px -18px rgb(16 32 51 / 0.28)",
    "--cs-grid": "rgb(16 32 51 / 0.07)",
    "--cs-glow-a": "rgb(12 138 126 / 0.1)",
    "--cs-glow-b": "rgb(37 99 235 / 0.08)",
    "--cs-on-danger": "#ffffff",
  },
  dark: {
    "--cs-bg": "#070b12",
    "--cs-fg": "#f3f6fb",
    "--cs-surface": "#0e1522",
    "--cs-surface-2": "#151d2d",
    "--cs-sidebar": "#0b1220",
    "--cs-header": "rgb(7 11 18 / 0.78)",
    "--cs-border": "#243247",
    "--cs-muted": "#9aabc2",
    "--cs-accent": "#2dd4bf",
    "--cs-accent-2": "#60a5fa",
    "--cs-accent-ink": "#04201c",
    "--cs-danger": "#fb7185",
    "--cs-warn": "#fbbf24",
    "--cs-success": "#34d399",
    "--cs-overlay": "rgb(2 8 20 / 0.62)",
    "--cs-placeholder": "#7f93ab",
    "--cs-code": "#121b2c",
    "--cs-ring": "rgb(45 212 191 / 0.28)",
    "--cs-shadow-panel": "0 18px 40px -28px rgb(2 8 20 / 0.9)",
    "--cs-shadow-popover": "0 24px 50px -18px rgb(2 8 20 / 0.85)",
    "--cs-grid": "rgb(255 255 255 / 0.03)",
    "--cs-glow-a": "rgb(45 212 191 / 0.12)",
    "--cs-glow-b": "rgb(96 165 250 / 0.1)",
    "--cs-on-danger": "#ffffff",
  },
};

type ThemeState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeState | null>(null);

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.style.colorScheme = theme;
  root.style.backgroundColor = THEME_COLORS[theme];
  root.classList.toggle("dark", theme === "dark");
  root.classList.toggle("light", theme === "light");

  const vars = THEME_VARS[theme];
  for (const [name, value] of Object.entries(vars)) {
    root.style.setProperty(name, value);
  }

  if (document.body) {
    document.body.setAttribute("data-theme", theme);
    document.body.style.backgroundColor = THEME_COLORS[theme];
    document.body.style.color = vars["--cs-fg"] ?? "";
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
    if (document.documentElement.getAttribute("data-theme") === "light") {
      return "light";
    }
    return window.localStorage.getItem(THEME_STORAGE_KEY) === "light"
      ? "light"
      : "dark";
  } catch {
    return "dark";
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");

  useLayoutEffect(() => {
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
    <ThemeContext.Provider value={value}>
      <div data-theme={theme} className="min-h-full">
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
