---
name: Inboria chat forced [mail#ID] citation
description: Why every short-memory line that names a specific mail must carry its real [mail#ID], or the model links the wrong email.
---

# Inboria chat — forced citation borrows wrong IDs

The `/inboria/chat` system prompt has ABSOLUTE rules forcing the model to append `[mail#XXXX]` to ANY specific mail it mentions (sender/subject/content), including bilan/relances/brief answers. The frontend renders `[mail#ID]` as an "Ouvrir" chip that opens `/dashboard?emailId=ID`.

**Rule:** every `memoryLines.push(...)` that describes a specific email MUST include that email's real `[mail#${id}]`. If the line names a mail but omits the ID, the model is still forced to cite one — so it grabs an arbitrary unrelated ID from elsewhere in the context, and the "Ouvrir" chip opens the WRONG email.

**Why:** observed live — asking "que devrais-je relancer en priorité ?" listed follow-ups (relances) whose memory lines had no ID; the model attached random IDs, so clicking opened an unrelated mail. The follow-ups/snoozed/scheduled Supabase queries selected sender/subject but not `id`.

**How to apply:** when adding/editing any section of the short-memory context builder (`inboria-context.ts`), if a line references a specific mail, select `id` in its query and append ` [mail#${id}]`. Sections that already do it right: inbox, sent, attachments, contact-360. Watch newly added lists (reportés/programmés/relances and any future per-contact list).
