---
name: OVH Email Pro IMAP host
description: OVH Email Pro mailboxes need a different IMAP host than the generic OVH default; relevant when connecting/debugging OVH accounts in Inboria.
---

# OVH Email Pro vs generic OVH (IMAP host)

OVH sells several mail tiers. The IMAP host differs by tier:
- **MX Plan** (free, mutualized) → `ssl0.ovh.net`
- **Email Pro** (paid, 15 GB/box, account id like `emailpro-wnNNNNN-1`) → `pro3.mail.ovh.net` (port 993)
- Exchange / Zimbra → other hosts

**Why:** the in-app "Autre fournisseur (IMAP)" button in settings prefills the generic `ssl0.ovh.net`, which FAILS for Email Pro boxes. Email Pro boxes must use `pro3.mail.ovh.net:993` (visible in api-server imap-sync logs for working OVH connections like support@inboria.com).

**How to apply:** when a user connects an OVH mailbox and it's an Email Pro account, tell them to open "Configuration avancée" and set host `pro3.mail.ovh.net`, port `993`. The generic default won't connect. A dedicated "OVH Email Pro" provider preset would remove this trap (offered to user, not yet built).
