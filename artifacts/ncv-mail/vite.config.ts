import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { VitePWA } from "vite-plugin-pwa";

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error(
    "BASE_PATH environment variable is required but was not provided.",
  );
}

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false,
      includeAssets: [
        "favicon.svg",
        "favicon.ico",
        "favicon.png",
        "apple-touch-icon.png",
        "logo-icon-192.png",
        "logo-icon-512.png",
        "logo-maskable-192.png",
        "logo-maskable-512.png",
      ],
      manifest: {
        name: "Inboria",
        short_name: "Inboria",
        description:
          "Inboria — votre boîte mail B2B sous pilote intelligent.",
        theme_color: "#0b1220",
        background_color: "#0b1220",
        display: "standalone",
        orientation: "portrait-primary",
        scope: "/",
        id: "/dashboard",
        start_url: "/dashboard",
        lang: "fr",
        categories: ["productivity", "business"],
        icons: [
          {
            src: "logo-icon-192.png?v=9",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "logo-icon-512.png?v=9",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "logo-maskable-192.png?v=9",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "logo-maskable-512.png?v=9",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        screenshots: [
          {
            src: "screenshot-desktop.png?v=9",
            sizes: "1280x720",
            type: "image/png",
            form_factor: "wide",
            label: "Inboria — Email Autopilot sur ordinateur",
          },
          {
            src: "screenshot-mobile.png?v=9",
            sizes: "720x1280",
            type: "image/png",
            label: "Inboria — Email Autopilot sur mobile",
          },
        ],
      },
      workbox: {
        // Pre-cache only the static app shell. NEVER cache anything
        // dynamic (API responses, Supabase calls, mail content) — those
        // must always hit the network so the user sees fresh data.
        // The main JS bundle is currently > 3 MB (heavy SPA), so bump
        // the precache size limit to 6 MB to accommodate it.
        maximumFileSizeToCacheInBytes: 16 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        // L'add-in Outlook (taskpane statique) ne doit JAMAIS être pré-caché
        // ni servi par le service worker — il vit hors du SPA et doit rester
        // frais (Office charge ces pages dans son propre webview).
        globIgnores: ["**/inboria-addin/**"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/inboria-addin\//],
        // Force the new SW to activate immediately on install so the
        // PWA picks up the latest deployment without requiring the
        // user to fully close + reopen the installed app.
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Static assets (hashed by Vite) → cache-first.
            // CRITICAL: explicitly exclude anything served from /api/*
            // (some endpoints can return images, e.g. inline avatars or
            // attachment thumbnails) so dynamic API responses are never
            // cached by the service worker.
            urlPattern: ({ url, request, sameOrigin }) => {
              if (!sameOrigin) return false;
              if (url.pathname.startsWith("/api/")) return false;
              if (url.pathname.startsWith("/inboria-addin/")) return false;
              return (
                request.destination === "script" ||
                request.destination === "style" ||
                request.destination === "font" ||
                request.destination === "image"
              );
            },
            handler: "CacheFirst",
            options: {
              cacheName: "inboria-static-v1",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
        // Critical: never let the SW intercept API or auth traffic.
        navigateFallbackAllowlist: [/^(?!\/api\/).*/],
      },
      devOptions: {
        // Disable SW in dev to avoid caching weirdness with HMR.
        enabled: false,
      },
    }),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    hmr: {
      clientPort: 443,
    },
    // Dev-only: prevent the browser from serving any stale cached
    // assets (HTML, JS chunks, /@vite/client, etc.) across server
    // restarts. Without this, reloading a previously visited page
    // can yield a blank screen because the browser reuses chunks
    // that the new Vite server no longer knows about.
    headers: process.env.NODE_ENV !== "production"
      ? {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          "Pragma": "no-cache",
          "Expires": "0",
        }
      : undefined,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
