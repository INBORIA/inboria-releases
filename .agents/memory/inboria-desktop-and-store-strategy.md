---
name: Inboria multi-platform packaging strategy
description: How Inboria ships to desktop + app stores from the one web codebase; why Expo is being retired.
---

# Inboria packaging: one web app, wrapped per platform (Superhuman model)

The product is the **web app** (`artifacts/ncv-mail`, Vite/React PWA). Every other
platform is a thin shell around that same hosted web app — one codebase to maintain.

- **Desktop (Windows/macOS/Linux):** Electron wrapper in `artifacts/inboria-desktop`.
  It loads the hosted Inboria URL (`INBORIA_URL`, defaults to a constant in `main.cjs`
  — must be switched to the published domain before release). Installers are built by
  `.github/workflows/desktop-build.yml` on a `v*` tag.
- **App Store / Play Store:** planned via **Capacitor** (not yet built).
- **PWA install:** already works (browser "Install"); the simplest desktop/mobile install.
- **Expo app (`artifacts/inboria-mobile`):** to be **retired** — redundant once Capacitor wraps the web.

**Why:** user rejected the Expo path (bad Expo Go dev experience, double codebase). PWA
already works well; Superhuman/Slack/Notion all ship a web app wrapped in Electron +
store shells. One code, three shells.

## Hard environment limits (state these honestly, don't fake a binary)
- Replit's Linux sandbox **cannot** produce a signed Windows `.exe` or any macOS `.dmg`.
  macOS builds require macOS; signing requires the user's Apple/Google certs. Real
  installers are produced by **GitHub Actions** (matrix win/mac/linux). This is the
  industry standard, not a workaround.
- Store submission + dev accounts (Apple ~$99/yr, Google $25 once) are the user's to do.

## How to apply / gotchas
- `artifacts/inboria-desktop` is deliberately **excluded from the pnpm workspace**
  (`- "!artifacts/inboria-desktop"` in `pnpm-workspace.yaml`) so Electron's heavy install
  never burdens the main monorepo. It has its own plain `package.json` (no `@workspace/`
  name, no `catalog:`); CI installs it standalone with `npm install`.
- CI: build step must use `--publish never`; the dedicated `release` job publishes and
  needs `permissions: contents: write` (else duplicate/racey publish or 403).
- `/telecharger` marketing page download buttons use a placeholder `RELEASES_URL` — must
  be set to the real GitHub releases URL once the repo/build exists.
