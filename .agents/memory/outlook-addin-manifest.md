---
name: Outlook add-in manifest (VersionOverrides)
description: Non-obvious schema requirement for the dynamically-generated Outlook mail add-in manifest that blocks sideload if wrong.
---

# Outlook add-in manifest gotcha

The Inboria Outlook add-in manifest is generated dynamically by the backend
(`GET /api/inboria/outlook-manifest.xml`) from the request Host so URLs match
dev/prod automatically.

**Rule:** the `<VersionOverrides>` node MUST use a versioned `xsi:type`
(`VersionOverridesV1_0`), NOT the bare `xsi:type="VersionOverrides"`.

**Why:** Outlook's sideload validator rejects the manifest when the type is the
unversioned `VersionOverrides`, silently blocking the whole add-in install. This
was caught only in code review, not by typecheck or curl (the XML still serves
200 — the failure happens inside Outlook).

**How to apply:** when editing the generated manifest XML, keep the versioned
type. The taskpane/commands/icon URLs assume the web artifact is served at root
(BASE_PATH "/"). If the ncv-mail base path ever becomes non-root, the manifest
URL builder must prepend that base or the assets 404 inside Outlook.
