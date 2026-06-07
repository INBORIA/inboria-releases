---
name: Scheduled-send "handled" marking parity & IDOR guard
description: How scheduled forwards/replies mark the original email "traité" safely, and why authz must happen at schedule time.
---

When a scheduled email (reply OR forward) is sent by the background worker, it must mark the original email as "traité" (handled), to match the immediate-send path.

**Rule:** authorize the handled-target at SCHEDULE time (in `POST /emails/schedule`) via `userCanHandleEmail`, exactly like immediate send. Store the authorized id in the dedicated column `emails.scheduled_mark_handled_id` (migration applied manually in Supabase). The worker marks handled ONLY from `scheduled_mark_handled_id` — never from `reply_to_email_id`.

**Why:**
- The worker runs with the service-role client (bypasses RLS) and is fire-and-later. If it marked handled by trusting `reply_to_email_id` (or any user-supplied id without a check), an authenticated user could schedule a message referencing another tenant's email id (guessable bigint) and get that email marked handled → IDOR / broken access control. Caught in code review.
- `reply_to_email_id` legitimately exists for threading (In-Reply-To headers) and is NOT access-controlled on write, so it must not double as the authorized "handled" pointer.
- A forward is not a reply (cf. the "transfert ≠ réponse" convention): forwards keep `reply_to_email_id` NULL so they aren't classified as replies in Envoyés — hence the need for a separate `scheduled_mark_handled_id`.

**How to apply:** any future deferred/background mutation of another row's state driven by a user-supplied id must re-use the same authz helper the synchronous path uses, at the moment the user makes the request — not in the worker. Degrade gracefully (skip the column write) when the migration column probe is false.
