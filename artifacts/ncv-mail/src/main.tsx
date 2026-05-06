import { createRoot } from "react-dom/client";
import "@/i18n";
import App from "./App";
import "./index.css";
import { isPaymentsEnabled } from "@/lib/feature-flags";
import { ErrorBoundary } from "@/components/error-boundary";
import { registerSW } from "virtual:pwa-register";

if (typeof window !== "undefined") {
  if (import.meta.env.DEV) {
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
