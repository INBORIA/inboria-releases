import { createRoot } from "react-dom/client";
import "@/i18n";
import App from "./App";
import "./index.css";
import { isPaymentsEnabled } from "@/lib/feature-flags";
import { ErrorBoundary } from "@/components/error-boundary";
import { registerSW } from "virtual:pwa-register";

// Capture du deep-link « Ouvrir dans Inboria » (add-on Gmail → /dashboard?emailId=123)
// AU TOUT PREMIER INSTANT du chargement de page, avant que React, l'auth Supabase
// ou les redirects de route (ProtectedRoute → /login) ne puissent effacer le
// ?emailId de l'URL. La réhydratation de session sur un onglet neuf peut être
// lente (locks gotrue ~5s) et provoquer plusieurs redirects qui perdent la query.
// On stocke donc l'emailId ici, puis le Dashboard le restaure à son montage même
// si l'URL l'a perdu entre-temps. TTL court pour éviter toute réouverture obsolète.
if (typeof window !== "undefined") {
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("emailId");
    const num = raw ? Number(raw) : NaN;
    // On ne capture QUE les deep-links des ponts (add-on Gmail / add-in Outlook /
    // extension navigateur), toujours marqués par ?from=gmail|outlook|extension.
    // Évite de « mémoriser » un emailId issu d'une navigation interne (chat
    // Inboria…) qui pourrait rouvrir un mail par erreur lors d'un rechargement.
    const from = (params.get("from") || "").toLowerCase();
    if (
      window.location.pathname.includes("/dashboard") &&
      (from === "gmail" || from === "outlook" || from === "extension") &&
      Number.isFinite(num) &&
      num > 0
    ) {
      window.sessionStorage.setItem(
        "inboria.pendingEmailId",
        JSON.stringify({ id: num, ts: Date.now() }),
      );
      // Trace temporaire de diagnostic (deep-link Gmail/Outlook) — confirme que
      // ce bundle (avec le fix) tourne bien côté navigateur lors du test.
      console.info("[inboria] deep-link emailId capturé au boot:", num, "from:", from);
    }
  } catch {
    // sessionStorage indisponible (mode privé) — non fatal.
  }
}

if (typeof document !== "undefined") {
  const neutralizeBodyLock = () => {
    const body = document.body;
    if (!body) return;
    const style = body.style;
    if (style.paddingRight) style.paddingRight = "";
    if (style.marginRight) style.marginRight = "";
    if (style.overflow === "hidden") style.overflow = "";
    if (style.overflowY === "hidden") style.overflowY = "";
    const html = document.documentElement;
    if (html.style.paddingRight) html.style.paddingRight = "";
    if (html.style.overflow === "hidden") html.style.overflow = "";
    if (html.hasAttribute("data-scroll-locked")) {
      html.removeAttribute("data-scroll-locked");
    }
  };
  const observer = new MutationObserver(neutralizeBodyLock);
  const start = () => {
    neutralizeBodyLock();
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["style", "data-scroll-locked"],
    });
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["style", "data-scroll-locked"],
    });
  };
  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });
}

if (typeof window !== "undefined") {
  const isReplitDevPreview =
    typeof window.location !== "undefined" &&
    /\.(picard|replit)\.dev$/.test(window.location.hostname);
  if (import.meta.env.DEV || isReplitDevPreview) {
    // In development, actively unregister any previously installed service
    // worker and wipe its caches so editors always see the latest content
    // without manual cache clearing.
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister().catch(() => {}));
      }).catch(() => {});
    }
    if (typeof caches !== "undefined") {
      caches.keys().then((keys) => {
        keys.forEach((k) => caches.delete(k).catch(() => {}));
      }).catch(() => {});
    }
  } else {
    // Auto-update PWA: when a new deployment is available, install the new
    // service worker, take control, then reload the app once so users on
    // the installed PWA always see the latest version without having to
    // quit and reopen the app manually.
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        updateSW(true);
      },
      onRegisteredSW(_swUrl, registration) {
        if (!registration) return;
        // Poll for updates every hour while the PWA stays open.
        setInterval(() => {
          registration.update().catch(() => {});
        }, 60 * 60 * 1000);
      },
    });
  }
}

if (isPaymentsEnabled() && typeof document !== "undefined") {
  const script = document.createElement("script");
  script.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
  script.async = true;
  document.head.appendChild(script);
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
