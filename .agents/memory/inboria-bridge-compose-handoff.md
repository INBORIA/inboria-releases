---
name: Bridge → app compose pre-fill handoff
description: How "Modifier dans Inboria" carries a proposed draft from the 3 bridges into the app's pre-filled composer
---

# Bridge → app compose pre-fill handoff

"Modifier dans Inboria" (in the Outlook add-in, browser extension, and Gmail add-on) opens the app composer ALREADY pre-filled (to/subject/body) with Inboria's proposed draft.

Transport = URL **fragment** `#/dashboard?from=<src>#inboria-draft=<encodeURIComponent(JSON({to,subject,body,emailId}))>`.

**Why a fragment, not query/server:** the fragment is never sent to the server (stays out of server logs) and avoids any server stash / DB migration. The user explicitly rejected server storage for this. Fragments also hold long payloads fine on the browser side.

**How to apply / invariants:**
- App side reuses the EXISTING internal prefill consumer (`consumePrefillAndOpen` in dashboard `index.tsx`, which reads sessionStorage key `inboria.compose.prefill` → `setComposePrefill` + `setIsComposeOpen(true)`). Do not invent a parallel path.
- `main.tsx` captures the fragment at the very first instant (before the auth redirect dance can drop it), writes `inboria.compose.prefill` + flag `inboria.compose.pendingOpen=1`, then strips the hash so a reload won't re-open the composer. The dashboard effect consumes the flag once (removes it).
- The three bridges compute the recipient with the SAME fallback as their `sendDraft` (draft.to → current sender). Keep them in lockstep.

**Gmail caveat (shared constraint, NOT a new bug):** the Gmail add-on can only pass the draft to the click handler via `CardService.newAction().setParameters({draftTo,draftSubject,draftBody})`. Apps Script caps action-parameter size, so a *very* long body could be truncated/rejected. This is the same mechanism the already-working "Envoyer" button uses, so it's a pre-existing shared limit, not a regression. Normal reply drafts are well under the limit. Outlook/extension have no such limit (fragment built directly in JS).

**Operational:** after editing any bridge, the user must reload the extension AND re-deploy the Gmail add-on (paste Code.gs). The extension zip (`public/inboria-extension.zip`) must be regenerated after editing `panel.js` (python zipfile, files at archive root).
