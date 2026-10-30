"use client";

import { useState, useRef, useEffect, useCallback } from "react";

export type ThemeMode = "light" | "dark" | "system";

interface ThemeToggleProps {
  className?: string;
  align?: "left" | "right";
}

export function ThemeToggle({
  className = "",
  align = "right",
}: ThemeToggleProps) {
  const [mode, setMode] = useState<ThemeMode>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync state with DOM and media query
  const applyTheme = useCallback((targetMode: ThemeMode) => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const systemDark = mql.matches;
    const isDark =
      targetMode === "dark" || (targetMode === "system" && systemDark);
    const resolved = isDark ? "dark" : "light";

    setResolvedTheme(resolved);

    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.remove("dark");
      root.classList.add("light");
    }
  }, []);

  // Initialize and attach listener for real-time `prefers-color-scheme` updates
  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("ts_theme") as ThemeMode | null;
    const initialMode: ThemeMode =
      stored === "light" || stored === "dark" || stored === "system"
        ? stored
        : "system";

    setMode(initialMode);
    applyTheme(initialMode);

    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemChange = () => {
      const currentStored = localStorage.getItem(
        "ts_theme",
      ) as ThemeMode | null;
      if (!currentStored || currentStored === "system") {
        applyTheme("system");
      }
    };

    if (mql.addEventListener) {
      mql.addEventListener("change", handleSystemChange);
      return () => mql.removeEventListener("change", handleSystemChange);
    } else if (mql.addListener) {
      mql.addListener(handleSystemChange);
      return () => mql.removeListener(handleSystemChange);
    }
  }, [applyTheme]);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const selectMode = (newMode: ThemeMode) => {
    setMode(newMode);
    setIsOpen(false);
    if (newMode === "system") {
      localStorage.removeItem("ts_theme");
    } else {
      localStorage.setItem("ts_theme", newMode);
    }
    applyTheme(newMode);
  };

  if (!mounted) {
    return <div className={`w-8 h-8 rounded-lg bg-transparent ${className}`} />;
  }

  const tooltipLabel =
    mode === "system"
      ? `System Theme (${resolvedTheme === "dark" ? "Dark" : "Light"})`
      : mode === "dark"
        ? "Dark Mode"
        : "Light Mode";

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={tooltipLabel}
        title={tooltipLabel}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className={`p-2 rounded-lg text-spruce-700 dark:text-spruce-300 hover:text-spruce-950 dark:hover:text-white hover:bg-spruce-100 dark:hover:bg-spruce-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-spruce-400 ${className}`}
      >
        {mode === "system" ? (
          // Monitor/Laptop icon for system preference
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-4 h-4 text-spruce-700 dark:text-spruce-300"
          >
            <rect width="20" height="14" x="2" y="3" rx="2" />
            <line x1="8" x2="16" y1="21" y2="21" />
            <line x1="12" x2="12" y1="17" y2="21" />
          </svg>
        ) : resolvedTheme === "dark" ? (
          // Moon icon
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-4 h-4 text-spruce-300 hover:text-spruce-200 transition-transform duration-200 hover:-rotate-12"
          >
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
          </svg>
        ) : (
          // Sun icon
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-4 h-4 text-spruce-700 hover:text-spruce-900 transition-transform duration-200 hover:rotate-45"
          >
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2" />
            <path d="M12 20v2" />
            <path d="m4.93 4.93 1.41 1.41" />
            <path d="m17.66 17.66 1.41 1.41" />
            <path d="M2 12h2" />
            <path d="M20 12h2" />
            <path d="m6.34 17.66-1.41 1.41" />
            <path d="m19.07 4.93-1.41 1.41" />
          </svg>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          className={`absolute ${
            align === "right" ? "right-0" : "left-0"
          } mt-2 w-48 rounded-xl border border-spruce-200 dark:border-spruce-700/80 bg-white/95 dark:bg-spruce-900/95 backdrop-blur-md shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 text-xs`}
        >
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-spruce-500 border-b border-spruce-100 dark:border-spruce-800">
            Appearance
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={() => selectMode("light")}
            className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors ${
              mode === "light"
                ? "bg-spruce-100 text-spruce-950 font-bold dark:bg-spruce-800 dark:text-spruce-300"
                : "text-spruce-700 dark:text-spruce-300 hover:bg-spruce-50 dark:hover:bg-spruce-800/60"
            }`}
          >
            <span className="flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-3.5 h-3.5 text-amber-500"
              >
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2" />
                <path d="M12 20v2" />
                <path d="m4.93 4.93 1.41 1.41" />
                <path d="m17.66 17.66 1.41 1.41" />
                <path d="M2 12h2" />
                <path d="M20 12h2" />
                <path d="m6.34 17.66-1.41 1.41" />
                <path d="m19.07 4.93-1.41 1.41" />
              </svg>
              <span>Light</span>
            </span>
            {mode === "light" && (
              <span className="text-spruce-600 dark:text-spruce-300 font-bold">
                ✓
              </span>
            )}
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => selectMode("dark")}
            className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors ${
              mode === "dark"
                ? "bg-spruce-100 text-spruce-950 font-bold dark:bg-spruce-800 dark:text-spruce-300"
                : "text-spruce-700 dark:text-spruce-300 hover:bg-spruce-50 dark:hover:bg-spruce-800/60"
            }`}
          >
            <span className="flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-3.5 h-3.5 text-spruce-400"
              >
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
              </svg>
              <span>Dark</span>
            </span>
            {mode === "dark" && (
              <span className="text-spruce-600 dark:text-spruce-300 font-bold">
                ✓
              </span>
            )}
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => selectMode("system")}
            className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors ${
              mode === "system"
                ? "bg-spruce-100 text-spruce-950 font-bold dark:bg-spruce-800 dark:text-spruce-300"
                : "text-spruce-700 dark:text-spruce-300 hover:bg-spruce-50 dark:hover:bg-spruce-800/60"
            }`}
          >
            <span className="flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-3.5 h-3.5 text-spruce-500"
              >
                <rect width="20" height="14" x="2" y="3" rx="2" />
                <line x1="8" x2="16" y1="21" y2="21" />
                <line x1="12" x2="12" y1="17" y2="21" />
              </svg>
              <span>System (Auto)</span>
            </span>
            {mode === "system" && (
              <span className="text-spruce-600 dark:text-spruce-300 font-bold">
                ✓
              </span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
