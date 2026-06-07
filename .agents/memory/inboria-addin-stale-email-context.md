---
name: Outlook add-in stale email context
description: Why the Outlook/Office add-in taskpane can answer the WRONG email, and the invariant that prevents it.
---

# Office add-in taskpane reuses one page across emails → stale resolved email id

The Inboria Outlook add-in taskpane is a single long-lived page. When the panel
stays open (pinned, or simply reused by new Outlook / OWA) and the user navigates
to another email, the page is NOT reloaded. Any module-level state about "the
current email" therefore goes stale.

The concrete bug: the chat sent a resolved internal `currentEmailId` to the chat
endpoint. The server injects that email at the TOP of the LLM context as
"MAIL ACTUELLEMENT OUVERT À L'ÉCRAN" and instructs the model to reply to it,
overriding the inline subject/body the quick-action also sends. So a reply was
generated for a previously-viewed mail (e.g. an old "test") instead of the mail
actually on screen.

**Invariant:** the resolved internal email id MUST track the currently-displayed
mail. Enforce it two ways together:
1. Reconcile before every action — re-resolve from `item.internetMessageId`
   whenever it differs from the one the id was resolved for; null the id first so
   a failed/slow resolve can never reuse the old one; only commit the resolved id
   if the user has not navigated again in the meantime.
2. Register `Office.EventType.ItemChanged` (guarded, once) to reset + re-resolve
   when the user switches mail with the panel open.

**Why:** the server-side "open mail" injection is high priority and silently wins
over inline context; a stale id is not a cosmetic glitch, it makes the AI answer
the wrong person.

**How to apply:** any feature that consumes the resolved email id (send reply,
"Modifier dans Inboria" deep-link, etc.) must use an id tied to the moment the
draft was generated — freeze it onto the draft object — not read the mutable
global at click time, because the user may have navigated after generation.
The same persistent-page reasoning applies to the Gmail add-on and browser
extension bridges.
