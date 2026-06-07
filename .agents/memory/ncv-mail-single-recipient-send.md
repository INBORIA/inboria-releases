---
name: ncv-mail single-recipient send constraint
description: The compose/reply/forward send path accepts only ONE recipient; don't build multi-recipient UX without backend work.
---

# Single-recipient send constraint (ncv-mail)

The email send path validates the recipient with a single-address regex
(`/^[^\s@]+@[^\s@]+\.[^\s@]+$/` on `to.trim()`), and stores `recipient: to`
as one address. The compose, reply, and forward "To" fields are therefore
**single recipient** in practice.

**Why:** when adding the Outlook-style recipient autocomplete (`RecipientInput`),
the first version appended a trailing comma after each pick to allow chaining
multiple addresses. That broke send entirely — `"user@x.com,"` fails the
single-address regex. Fixed by making the autocomplete replace the field with
exactly one chosen address (no comma).

**How to apply:** before adding any multi-recipient feature (To/Cc/Bcc with
several addresses, comma chips, etc.), you must FIRST extend the backend send
route to split + validate each address and pass them through the provider
adapters (Gmail/Outlook/IMAP). Do not ship multi-recipient UX on the frontend
alone.
