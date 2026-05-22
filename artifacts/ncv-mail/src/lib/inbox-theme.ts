// Réception (#247) — light/dark theme toggle.
// Applies a data attribute to <html> so a CSS overlay in index.css can
// repaint the inbox in a light palette without touching every component.
// Defaults to dark; persisted in localStorage as `ncv-theme`.
import { useEffect, useState, useCallback } from "react";

export type NcvTheme = "light" | "dark";
const STORAGE_KEY = "ncv-theme";
const ATTR = "data-ncv-theme";

function readStored(): NcvTheme {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark") return v;
  } catch {}
  return "dark";
}

function applyToDom(theme: NcvTheme) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute(ATTR, theme);
}

/**
 * Mount-only hook for the Réception page itself: marks <html> with
 * data-ncv-page="inbox" so the light overlay CSS in index.css activates.
 * Other pages remain dark-only because the attribute isn't set.
 */
export function useMarkInboxPage(): void {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const prev = document.documentElement.getAttribute("data-ncv-page");
    document.documentElement.setAttribute("data-ncv-page", "inbox");
    return () => {
      if (prev) document.documentElement.setAttribute("data-ncv-page", prev);
      else document.documentElement.removeAttribute("data-ncv-page");
    };
  }, []);
}

/** Alias sémantique : active la capacité « light » sur la page hôte. */
export const useEnableLightTheme = useMarkInboxPage;

export function useNcvTheme(): { theme: NcvTheme; toggle: () => void; setTheme: (t: NcvTheme) => void } {
  const [theme, setThemeState] = useState<NcvTheme>(() => readStored());

  useEffect(() => {
    applyToDom(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {}
  }, [theme]);

  // Sync across tabs / panes.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && (e.newValue === "light" || e.newValue === "dark")) {
        setThemeState(e.newValue);
      }
    };
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent).detail as NcvTheme | undefined;
      if (detail === "light" || detail === "dark") setThemeState(detail);
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("ncv-theme-change", onCustom as EventListener);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("ncv-theme-change", onCustom as EventListener);
    };
  }, []);

  const setTheme = useCallback((t: NcvTheme) => {
    const apply = () => {
      setThemeState(t);
      applyToDom(t);
      try {
        window.dispatchEvent(new CustomEvent("ncv-theme-change", { detail: t }));
      } catch {}
    };
    // Pas de View Transitions API (snapshots → micro-basculement visible).
    // À la place : on flag <html> avec `ncv-theme-transitioning` pendant
    // ~300ms ; le CSS de index.css applique alors une transition douce
    // (background/color/border/fill) à TOUS les éléments, puis on retire
    // la classe pour ne plus pénaliser les interactions normales.
    const root = typeof document !== "undefined" ? document.documentElement : null;
    if (!root) { apply(); return; }
    root.classList.add("ncv-theme-transitioning");
    apply();
    window.setTimeout(() => {
      root.classList.remove("ncv-theme-transitioning");
    }, 320);
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return { theme, toggle, setTheme };
}
