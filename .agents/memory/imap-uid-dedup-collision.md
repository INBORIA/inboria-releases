---
name: IMAP UID dedup collision
description: Why inbound IMAP mail silently vanished — native-suffix dedup matched UIDs across different mailboxes.
---

# IMAP UID dedup collision (inbound mail silently dropped)

In `auto-sync.ts` `saveEmail`, IMAP `external_id` = `imap:${email}:${uid}` and the
"native message id" passed for IMAP is the **IMAP UID** — a small integer assigned
**per mailbox**, NOT globally unique. Every connected box has a message UID 1, 2, 3…

The native-suffix dedup did `external_id LIKE %:${nativeMessageId}` scoped only by
`shared_mailbox_id`. So an incoming mail with UID 7 on box A matched
`imap:other@box.com:7` on box B and was dropped → for a freshly-connected box,
`newEmails` was always 0 and **nothing was ever saved** (symptom: "I receive mail in
OVH webmail but see nothing in the app"). Sync logs showed `fetched: N,
duplicatesSkipped: N`.

**Rule:** never dedup IMAP by the bare UID suffix. UID is unique only *within one
mailbox*. For IMAP rely on (a) exact `external_id` and (b) RFC822 Message-ID
(`provider_message_id`), and scope the Message-ID dedup by the mailbox prefix
`imap:${email}:%` so a self-addressed mail between two of the user's own connected
boxes is kept once **per box**. The periodic cleanup `dedupeUserEmailsByNativeId`
was already safe because it skips suffixes shorter than 4 chars.

**Why:** UIDs collide trivially across mailboxes; the user connects many OVH boxes
(pro3.mail.ovh.net) sharing low UIDs.

**How to apply:** any change to sync dedup must gate suffix/native-id matching on
provider — IMAP UID is not a safe dedup key. Inbound IMAP shows only what is in the
**INBOX** (the sync locks INBOX + junk only); mail filed by a server-side rule into
another folder is invisible regardless of dedup.
