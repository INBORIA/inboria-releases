import { createRoot } from "react-dom/client";
import "@/i18n";
import App, { restorePersistedQueryCache } from "./App";
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
    // Repli pont : pas d'emailId déjà résolu côté pont, mais identifiants bruts
    // présents (sujet / expéditeur / Message-ID). On les mémorise pour que l'app —
    // authentifiée par SA PROPRE session — résolve le mail elle-même. Crucial
    // quand le jeton de l'extension a expiré (sa résolution côté pont → 401).
    if (
      window.location.pathname.includes("/dashboard") &&
      (from === "gmail" || from === "outlook" || from === "extension")
    ) {
      const rv = {
        subject: params.get("xsubject") || "",
        from: params.get("xfrom") || "",
        providerMessageId: params.get("xmid") || "",
        nativeMessageId: params.get("xnid") || "",
      };
      if (rv.subject || rv.from || rv.providerMessageId || rv.nativeMessageId) {
        window.sessionStorage.setItem(
          "inboria.pendingResolve",
          JSON.stringify({ ...rv, ts: Date.now() }),
        );
      }
    }
    // Pont « Modifier dans Inboria » : le brouillon proposé est transporté dans
    // le FRAGMENT d'URL (#inboria-draft=...). Avantages : gère les brouillons
    // longs sans stockage serveur ni migration, et le texte n'apparaît pas dans
    // les journaux serveur (le fragment n'est jamais envoyé au serveur). On le
    // capture ici, au tout premier instant, car le hash peut être perdu pendant
    // la danse d'authentification. On le range dans la MÊME clé que le
    // pré-remplissage du composeur interne (chat Inboria) pour réutiliser le
    // même consommateur côté Dashboard.
    const hash = window.location.hash || "";
    const DRAFT_MARK = "#inboria-draft=";
    if (
      window.location.pathname.includes("/dashboard") &&
      (from === "gmail" || from === "outlook" || from === "extension") &&
      hash.indexOf(DRAFT_MARK) === 0
    ) {
      try {
        const parsed = JSON.parse(
          decodeURIComponent(hash.slice(DRAFT_MARK.length)),
        );
        window.sessionStorage.setItem(
          "inboria.compose.prefill",
          JSON.stringify({
            to: typeof parsed?.to === "string" ? parsed.to : "",
            subject: typeof parsed?.subject === "string" ? parsed.subject : "",
            body: typeof parsed?.body === "string" ? parsed.body : "",
          }),
        );
        window.sessionStorage.setItem("inboria.compose.pendingOpen", "1");
      } catch {
        // fragment illisible — on ouvrira simplement le tableau de bord.
      }
      // On retire le fragment pour qu'un rechargement ne rouvre pas le composeur.
      try {
        const u = new URL(window.location.href);
        u.hash = "";
        window.history.replaceState({}, "", u.pathname + u.search);
      } catch {
        /* noop */
      }
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

function mountApp() {
  createRoot(document.getElementById("root")!).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>,
  );
}

// On restaure le cache des listes de mails (localStorage) AVANT le 1er rendu
// pour que la Réception s'affiche instantanément à la connexion, sans squelette
// gris. Garde-fou : si la restauration traîne (>700 ms) ou échoue, on démarre
// l'app quand même — jamais d'écran bloqué en attendant le cache.
const restoreGuard = new Promise<void>((resolve) => setTimeout(resolve, 700));
Promise.race([restorePersistedQueryCache().catch(() => {}), restoreGuard]).finally(
  mountApp,
);
