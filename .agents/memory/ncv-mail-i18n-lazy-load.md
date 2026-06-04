---
name: ncv-mail i18n lazy-load
description: ncv-mail loads locales on demand (1 chunk/lang); the zh-TW boot pitfall with load:languageOnly.
---

# ncv-mail i18n lazy loading

Only `fr` (fallbackLng) is bundled at boot. The other 42 locales load on demand via
`import.meta.glob("./locales/*.json", { import: "default" })` — Vite emits one JS chunk per
language, fetched only when that language becomes active (initial detected lang + every
`languageChanged`). `ensureLanguageLoaded(lng)` is idempotent (`loaded` Set + `inflight` Map)
and calls `i18n.addResourceBundle`.

**Why:** the old setup statically imported all 43 locale JSON (~9 MB) into the boot path,
bloating first paint. Routing was already lazy; the locales were the real weight.

**How to apply:** to make lazily-added bundles actually re-render the UI, init must use
`react: { useSuspense: false, bindI18nStore: "added" }`. Without `bindI18nStore: "added"`,
react-i18next won't re-render when a bundle arrives after first paint, and a non-fr user
stays stuck on French fallback.

## zh-TW pitfall (Traditional vs Simplified)

`load: "languageOnly"` collapses regional codes (`en-US`→`en`), and it can collapse
`zh-TW`→`zh`. `i18n.resolvedLanguage` may therefore report `zh` for a Traditional-Chinese
user, which would load `zh.json` (Simplified) — wrong.

Guards in place:
- Boot preload reads the **raw stored preference** `localStorage["inboria-lang"]` first
  (it keeps the full `zh-TW` code), then falls back to `i18n.language`, then
  `resolvedLanguage`.
- `normalizeCode` keeps `zh-TW` for all Traditional aliases (`zh-tw`/`zh_tw`/`zh-hant`/`zh-hk`),
  matching LanguageSwitcher; everything else is stripped to its 2-letter base.

**How to apply:** when adding a new regional variant that must stay distinct from its base
language, add it to `normalizeCode` AND ensure the boot/switch path preserves the full code,
or load:languageOnly will silently serve the base-language file.
