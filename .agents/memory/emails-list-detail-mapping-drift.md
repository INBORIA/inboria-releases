---
name: emails list vs detail mapping drift
description: ncv-mail GET /api/emails (list) and GET /api/emails/:id (detail) hand-map fields separately; they drift and silently break UI gated on those fields.
---

The ncv-mail email endpoints build their JSON response with **hand-written field mappers**, one for the list (`GET /api/emails`) and a separate one for the detail (`GET /api/emails/:id`). They are NOT shared, so a field added to detail is easy to forget in the list.

The dashboard merges them: `selectedEmail = emailDetailData ? {...listItem, ...detail} : listItem`. When the detail fetch hasn't resolved (or fails — e.g. gotrue auth-lock contention, which is common and shows as "Lock ... was released because another request stole it" in the browser console), the UI runs off the **list item only**.

**Why it matters:** any UI gated on a field (e.g. `isSharedContext = sharedMailboxId || assignedTo`, which controls the T004 reply-collision banner and the T005 "Brouillon partagé" button) silently disappears if that field is mapped in detail but missing from the list.

**How to apply:** when adding any field consumed by EmailDetail/dashboard gating, add it to BOTH the list mapper and the detail mapper (the SQL `select` usually already includes the column — only the response object omits it). Don't rely on the detail fetch populating it; assume the list item is the source of truth during contention.
