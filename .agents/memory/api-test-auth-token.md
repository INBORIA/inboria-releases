---
name: Minting a real user JWT to test authed api-server endpoints
description: How to call requireAuth-protected endpoints from a throwaway script using a real Supabase user token.
---

# Test authed `/api/...` endpoints offline by minting a real user JWT

`requireAuth` (artifacts/api-server/src/middlewares/auth.ts) only accepts a real Supabase
user access token (`supabaseAdmin.auth.getUser(token)`). The service key is NOT accepted.

To exercise an endpoint exactly as the browser would (real auth + org scoping), mint a
token in a temp Node script:

1. `admin.auth.admin.generateLink({ type: "magiclink", email })` → `data.properties.email_otp`
   (no email is actually sent; pick a real user, e.g. an org admin/owner from
   `organisation_members` joined via `admin.auth.admin.getUserById`).
2. anon client (`VITE_SUPABASE_PUBLISHABLE_KEY`): `anon.auth.verifyOtp({ email, token: email_otp, type: "email" })`
   → `data.session.access_token`.
3. `fetch("http://localhost:80/api/...", { headers: { Authorization: \`Bearer ${token}\` } })`.

Run scripts from `artifacts/api-server/` as a `.mjs` (package is `type: module`) so
`@supabase/supabase-js` resolves; env vars (VITE_SUPABASE_URL, SUPABASE_SECRET_KEY, anon
key) are present in the shell. Always go through the proxy `localhost:80`, not the service
port. Delete the temp script when done.

**Why:** lets you diff two engine modes / validate behavior on real data without a browser
and without weakening auth.
