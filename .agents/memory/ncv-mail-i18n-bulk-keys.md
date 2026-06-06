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

## Parity check first — new fr keys routinely ship untranslated
Flatten every locale and diff its key-set against `fr.json` (the reference superset)
before launch. Recently-added features land fr-only and silently fall back to French
in the other 42 langs (and sometimes en too). One pre-launch sweep found **103** such
keys (agenda.multi.*, calendars.*, classification.cleanupDuplicates.*, notificationsPage.*,
templates.picker*, apiKeys.*, inbox.shortcuts/help, wave1.snoozed*) — 36 missing even in en.
**How to apply:** any time after adding fr UI copy, run the flatten+set-diff vs fr and fill gaps.

## Ops note: parallel threads fill all 42 langs in ONE bash run
A Python script using `urllib` + `os.environ["OPENAI_API_KEY"]` + `gpt-4o`
(`response_format=json_object`) with `ThreadPoolExecutor(max_workers=10)`, one call per
language (all that language's missing keys in a single request, per-call `timeout=110`),
completes all 42 non-fr locales inside a single 120s bash call. Make it idempotent
(recompute missing keys per file each run, skip if none) so a timeout just resumes on re-run.
`json.dump(..., ensure_ascii=False, indent=2)` matches the existing format → small diffs
(set_nested appends new keys at the end of their parent). Validate JSON + re-diff after.
(Supersedes the older "killed after ~10 langs / sequential / re-run 3-4×" approach.)
