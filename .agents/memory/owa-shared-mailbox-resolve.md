---
name: OWA shared-mailbox email resolution
description: Why "open exact email" from the OWA/Exchange browser extension fails on shared mailboxes, and the safe fallback used.
---

# OWA / Exchange shared mailbox — resolving the exact email

When the browser extension opens Inboria on a specific email, it scrapes
subject + sender from the webmail DOM (no API / no Message-ID on OWA).

**Non-obvious failure:** on OWA/Exchange **shared mailboxes**, the scraped
"from" is frequently the **mailbox address itself (the recipient)**, not the
real sender. Sender-based resolution (`sender ILIKE %scrapedAddress%`) then
returns 0 rows → resolves null → lands on the Inbox.

**Why:** shared-mailbox reading panes surface the box address prominently;
the first email address found in the DOM is often the box, not the originator.

**How it's handled (resolve-email priority):**
1. RFC822 Message-ID (add-in / Office.js) — most reliable.
2. native external_id.
3. strict subject + sender.
4. **subject-only fallback** — exact normalized subject, resolve ONLY if
   exactly one match exists AND the candidate set is not truncated by the
   fetch limit (otherwise abstain). Guarantees it never opens the wrong mail.

**Rule:** the subject-only fallback must stay strictly unambiguous — exact
normalized equality + single non-truncated match. Never loosen to partial /
"most recent" without re-introducing wrong-mail risk (architect-flagged).
The reliable long-term path for real Exchange/OVH-Pro is the Outlook **add-in**
(exact Message-ID), not DOM scraping.
