// Réception (#247) — light/dark theme toggle.
// Applies a data attribute to <html> so a CSS overlay in index.css can
// repaint the inbox in a light palette without touching every component.
// Defaults to dark; persisted in localStorage as `ncv-theme`.
import { useEffect, useState, useCallback, type MouseEvent as ReactMouseEvent } from "react";

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

/**
 * Thème choisi par l'abonné (persisté en localStorage), pour le contrôleur
 * centralisé du routeur. Hors de l'app, on force toujours le sombre ; en
 * entrant dans l'app, on ré-applique ce choix.
 */
export function getStoredNcvTheme(): NcvTheme {
  return readStored();
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
    document.documentElement.setAttribute("data-ncv-page", "inbox");
    // Au démontage on RETIRE toujours l'attribut (jamais de « restauration »
    // de la valeur précédente) : le contrôleur centralisé du routeur (App.tsx)
    // est l'autorité unique et le ré-applique avant peinture sur les routes
    // /dashboard. Restaurer "inbox" ferait baver la palette claire de l'app
    // sur le site vitrine / login / inscription en quittant l'app.
    return () => {
      document.documentElement.removeAttribute("data-ncv-page");
    };
  }, []);
}

/** Alias sémantique : active la capacité « light » sur la page hôte. */
export const useEnableLightTheme = useMarkInboxPage;

export type ToggleOrigin = { x: number; y: number };

export function useNcvTheme(): {
  theme: NcvTheme;
  toggle: (origin?: ToggleOrigin | React.MouseEvent) => void;
  setTheme: (t: NcvTheme, origin?: ToggleOrigin | React.MouseEvent) => void;
} {
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

  const setTheme = useCallback((t: NcvTheme, origin?: ToggleOrigin | ReactMouseEvent) => {
    const apply = () => {
      setThemeState(t);
      applyToDom(t);
      try {
        window.dispatchEvent(new CustomEvent("ncv-theme-change", { detail: t }));
      } catch {}
    };

    // Circular reveal façon macOS Sonoma / Notion : on utilise la View
    // Transitions API et un clip-path animé depuis l'origine du clic
    // (bouton toggle) → le nouveau thème est révélé par un cercle qui
    // s'étend. Le swap des règles CSS est atomique (au moment du callback
    // de startViewTransition), donc pas d'interpolation foireuse avec
    // les overlays !important — seul le clip change.
    const doc = typeof document !== "undefined" ? (document as any) : null;
    const root = doc ? doc.documentElement : null;
    const supportsVT = doc && typeof doc.startViewTransition === "function";
    const prefersReduced =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!supportsVT || prefersReduced || !root) {
      apply();
      return;
    }

    // Calcule l'origine (px viewport) à partir du MouseEvent ou {x,y}.
    let cx = window.innerWidth / 2;
    let cy = window.innerHeight / 2;
    if (origin) {
      if ("clientX" in origin && "clientY" in origin) {
        const evt = origin as ReactMouseEvent;
        const target = evt.currentTarget as HTMLElement | null;
        if (target && typeof target.getBoundingClientRect === "function") {
          const r = target.getBoundingClientRect();
          cx = r.left + r.width / 2;
          cy = r.top + r.height / 2;
        } else if (typeof evt.clientX === "number") {
          cx = evt.clientX;
          cy = evt.clientY;
        }
      } else if (typeof (origin as ToggleOrigin).x === "number") {
        cx = (origin as ToggleOrigin).x;
        cy = (origin as ToggleOrigin).y;
      }
    }
    // Rayon maximal = distance du point d'origine au coin le plus
    // éloigné du viewport (pour que le cercle couvre tout l'écran).
    const maxR = Math.hypot(
      Math.max(cx, window.innerWidth - cx),
      Math.max(cy, window.innerHeight - cy)
    );

    root.style.setProperty("--ncv-reveal-x", `${cx}px`);
    root.style.setProperty("--ncv-reveal-y", `${cy}px`);
    root.style.setProperty("--ncv-reveal-r", `${maxR}px`);
    root.classList.add("ncv-theme-reveal");

    const transition = doc.startViewTransition(() => {
      apply();
    });
    transition.finished
      .catch(() => {})
      .finally(() => {
        root.classList.remove("ncv-theme-reveal");
        root.style.removeProperty("--ncv-reveal-x");
        root.style.removeProperty("--ncv-reveal-y");
        root.style.removeProperty("--ncv-reveal-r");
      });
  }, []);

  const toggle = useCallback(
    (origin?: ToggleOrigin | ReactMouseEvent) => {
      setTheme(theme === "dark" ? "light" : "dark", origin);
    },
    [theme, setTheme]
  );

  return { theme, toggle, setTheme };
}
