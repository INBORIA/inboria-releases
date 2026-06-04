---
name: ncv-mail shared-mailbox auto-close
description: Why an opened email closes "by itself" a few seconds after opening in a shared mailbox, and the fix pattern.
---

# Symptom
In a shared mailbox, an opened email closes on its own a few seconds after opening, without any user action. Started after adding realtime presence + shared-draft + comments channels.

# Root cause
Opening a shared email subscribes to several Supabase realtime channels at once (presence, shared draft, comments). They contend for the gotrue auth-token lock (navigator LockManager, `lock:sb-...-auth-token`, 5s timeout). The console shows repeated "Lock ... was released because another request stole it" rejections. Each lock steal triggers a Supabase auth event → the AuthProvider updates session/user → the **Dashboard remounts** → `selectedEmailId` (plain useState) resets → the mail closes.

Deep-link opens already survived this via a sessionStorage handoff; a normal click-open did not persist anything, so a remount lost it.

A second, compounding trap: the email-detail queryFn returned `null` on a transient missing token / non-ok response. React Query treats `null` as a successful result and **overwrites the cache**, blanking an already-open mail.

# Fix pattern
- Persist the open email id in sessionStorage on every selection change, restore it in the useState initializer, clear it when the mail is closed (id → null). Tab-scoped, with a generous TTL guard. This makes the open mail survive auth-triggered remounts.
- In any detail queryFn, **throw** on transient failure (no token / !resp.ok) instead of returning null, so React Query keeps the last good data instead of nuking it.

**Why:** durable — any future shared/realtime feature that opens more channels will worsen the auth-lock thrash and re-expose this class of "state resets on remount" bug.

**How to apply:** when a component holds important ephemeral UI state (open item, scroll pos) AND the app can remount on auth events, persist that state outside the component. Never let a queryFn return null/empty on a transient auth/network failure.
