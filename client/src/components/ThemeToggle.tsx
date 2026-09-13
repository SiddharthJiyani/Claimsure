"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";

export function ThemeToggle({
  compact = false,
}: {
  compact?: boolean;
}) {
  const { theme, setTheme, toggleTheme } = useTheme();

  if (compact) {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-surface-2 text-muted transition hover:text-foreground"
        aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      >
        {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
      </button>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-background p-1">
      <button
        type="button"
        onClick={() => setTheme("light")}
        className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition ${
          theme === "light"
            ? "bg-surface text-foreground shadow-sm"
            : "text-muted hover:text-foreground"
        }`}
      >
        <Sun size={13} />
        Light
      </button>
      <button
        type="button"
        onClick={() => setTheme("dark")}
        className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition ${
          theme === "dark"
            ? "bg-surface text-foreground shadow-sm"
            : "text-muted hover:text-foreground"
        }`}
      >
        <Moon size={13} />
        Dark
      </button>
    </div>
  );
}
