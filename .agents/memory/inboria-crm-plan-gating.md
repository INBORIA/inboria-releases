---
name: Inboria CRM plan gating & Slack/Notion removal
description: Which plans can use CRM, where the lock lives, and that Slack/Notion are gone — product/entitlement decisions, not derivable from a single file.
---

# CRM reserved to Pro/Business

CRM integrations (HubSpot, Pipedrive, Salesforce, Odoo) are **reserved to Pro/Business plans**.

- Enforcement lives at the OAuth/`/connect` entry only (`requireProPlan` → 403 `Integration reservee au plan Pro ou superieur`), matching the long-standing Odoo pattern.
- **Operational routes (sync / log-email / create-deal / create-task / contact-context / callbacks) are intentionally NOT plan-gated.**

**Why:** The user explicitly asked to lock CRM "comme Odoo" (parity with the existing Odoo gate), and "do what is asked, nothing more." Connect-only gating blocks the main case (a free user can never *start* using CRM). The remaining gap is a billing-leniency edge case, not a security hole: a user who was Pro, connected CRM, then downgraded keeps CRM working until they disconnect. There is no cross-tenant risk (`resolveContactExternalId` validates ownership).

**How to apply:** If the user later wants true runtime entitlement (close the downgrade gap), add a centralized `requireProPlan` guard to the operational CRM routes AND to Odoo's (otherwise Odoo stays inconsistent) — and keep GET `/integrations` (list) + DELETE (disconnect) ungated so downgraded users can still see/clean up.

# Slack / Notion removed (April 2026)

Slack notifications and Notion task-creation were removed (migration `2026_04_28_remove_slack_notion*`). Notifications and tasks are now fully internal; automation runs via API keys/webhooks. Product docs and the `SLACK_*` / `NOTION_*` env vars were stale references and have been corrected. Do not reintroduce them unless the user asks to bring the features back.
