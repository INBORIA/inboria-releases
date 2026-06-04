---
name: ncv-mail bulk i18n keys
description: How to add a new translation key across all 43 ncv-mail locale files efficiently.
---

# Adding i18n keys across all 43 ncv-mail locales

ncv-mail i18n = 43 per-language JSON files in `artifacts/ncv-mail/src/i18n/locales/`
(2-space indent, raw unicode, `fallbackLng: "fr"`, registered in `i18n/index.ts`).

To add new keys (e.g. a new marketing page) in every language:

1. Hand-write the **fr** (reference) and **en** values yourself.
2. Batch-translate the other 41 with the OpenAI integration (`setupReplitAIIntegrations`
   → `AI_INTEGRATIONS_OPENAI_*`, model `gpt-5.4`, `response_format: json_object`,
   concurrency ~4 + retries). One temp `.mjs` script run from `artifacts/api-server`
   (where `openai` resolves); delete it after.
3. Pass each language a short **formal-register note** in the system prompt
   (the conventions are spelled out in `replit.md`: e.g. de=Sie, ru=Вы Cyrillic,
   zh-TW=Traditional NOT Simplified, ar=MSA RTL no tashkeel, etc.).
   Always exclude brand/product names from translation (Inboria, Outlook, Gmail,
   OVH, Yahoo, iCloud, IMAP, iOS, Android…).
4. Insert via **idempotent text splice** (not full JSON re-stringify, keeps diffs small):
   insert the new key right after the `\n  "nav": {\n` open brace, and the new
   nested block right after `\n  "marketing": {\n`. Guard with a regex check so re-runs skip.

**Why:** full `JSON.parse`+`stringify` would reformat the entire 150-340 KB file (huge noisy diff).
Targeted splice after the parent open-brace is clean and re-runnable.
**How to apply:** any time the user asks to add UI/marketing copy that must exist in all 43 langs.
The sandbox (`code_execution`) has NO `process.env`; run the translation script via bash instead.

## Ops note: OpenAI batch script gets killed after ~10 langs in this env
The bash tool kills a long Node script (41 sequential OpenAI calls) after ~10 languages
(exit -1, no output). Make the inject step write per-language AND idempotent (skip files
already containing the new key), then just re-run the same script 3-4× until all 43 files
contain the key. Validate every locale with JSON.parse afterward.
