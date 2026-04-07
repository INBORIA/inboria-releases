import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";
import { triggerSyncForConnection } from "../services/auto-sync";

const router: IRouter = Router();

async function getOrgIdForAdmin(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("organisation_members")
    .select("organisation_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .eq("role", "admin")
    .single();
  return data?.organisation_id || null;
}

async function getOrgIdForMember(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("organisation_members")
    .select("organisation_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .single();
  return data?.organisation_id || null;
}

router.get("/shared-mailboxes", requireAuth, async (req, res): Promise<void> => {
  try {
    const orgId = await getOrgIdForMember(req.userId!);
    if (!orgId) {
      res.json([]);
      return;
    }

    const isAdmin = !!(await getOrgIdForAdmin(req.userId!));

    let mailboxes: any[] | null;
    if (isAdmin) {
      const result = await supabaseAdmin
        .from("shared_mailboxes")
        .select("id, name, email_address, connection_id, created_at")
        .eq("organisation_id", orgId)
        .order("created_at", { ascending: true });
      mailboxes = result.data;
    } else {
      const { data: memberEntries } = await supabaseAdmin
        .from("shared_mailbox_members")
        .select("shared_mailbox_id")
        .eq("user_id", req.userId!);
      const memberMailboxIds = (memberEntries || []).map((m: any) => m.shared_mailbox_id);
      if (memberMailboxIds.length === 0) {
        res.json([]);
        return;
      }
      const result = await supabaseAdmin
        .from("shared_mailboxes")
        .select("id, name, email_address, connection_id, created_at")
        .eq("organisation_id", orgId)
        .in("id", memberMailboxIds)
        .order("created_at", { ascending: true });
      mailboxes = result.data;
    }

    if (!mailboxes || mailboxes.length === 0) {
      res.json([]);
      return;
    }

    const enriched = [];
    for (const mb of mailboxes) {
      const { data: members } = await supabaseAdmin
        .from("shared_mailbox_members")
        .select("id, user_id, can_reply")
        .eq("shared_mailbox_id", mb.id);

      const { count: unreadCount } = await supabaseAdmin
        .from("emails")
        .select("id", { count: "exact", head: true })
        .eq("shared_mailbox_id", mb.id)
        .is("claimed_by", null)
        .neq("status", "supprime");

      enriched.push({
        id: mb.id,
        name: mb.name,
        emailAddress: mb.email_address,
        connectionId: mb.connection_id,
        createdAt: mb.created_at,
        memberCount: members?.length || 0,
        unclaimedCount: unreadCount || 0,
      });
    }

    res.json(enriched);
  } catch {
    res.status(500).json({ error: "Erreur lors de la récupération des boîtes partagées" });
  }
});

router.get("/shared-mailboxes/admin-connections", requireAuth, async (req, res): Promise<void> => {
  try {
    const orgId = await getOrgIdForAdmin(req.userId!);
    if (!orgId) {
      res.json([]);
      return;
    }

    const { data: connections } = await supabaseAdmin
      .from("email_connections")
      .select("id, provider, email_address, created_at, last_synced_at")
      .eq("user_id", req.userId!);

    const { data: existingMailboxes } = await supabaseAdmin
      .from("shared_mailboxes")
      .select("connection_id")
      .eq("organisation_id", orgId);

    const sharedConnectionIds = new Set((existingMailboxes || []).map((m: any) => m.connection_id).filter(Boolean));

    const enriched = (connections || []).map((c: any) => ({
      id: c.id,
      provider: c.provider,
      emailAddress: c.email_address,
      createdAt: c.created_at,
      lastSyncedAt: c.last_synced_at,
      alreadyShared: sharedConnectionIds.has(c.id),
    }));

    res.json(enriched);
  } catch {
    res.status(500).json({ error: "Erreur lors de la récupération des connexions" });
  }
});

router.post("/shared-mailboxes", requireAuth, async (req, res): Promise<void> => {
  try {
    const orgId = await getOrgIdForAdmin(req.userId!);
    if (!orgId) {
      res.status(403).json({ error: "Accès réservé aux administrateurs" });
      return;
    }

    const { connectionId, name } = req.body;
    if (!connectionId) {
      res.status(400).json({ error: "connectionId requis" });
      return;
    }

    const { data: conn } = await supabaseAdmin
      .from("email_connections")
      .select("id, email_address, provider")
      .eq("id", connectionId)
      .eq("user_id", req.userId!)
      .single();

    if (!conn) {
      res.status(404).json({ error: "Connexion email introuvable" });
      return;
    }

    const { data: existing } = await supabaseAdmin
      .from("shared_mailboxes")
      .select("id")
      .eq("organisation_id", orgId)
      .eq("connection_id", connectionId)
      .maybeSingle();

    if (existing) {
      res.status(409).json({ error: "Cette adresse est déjà partagée" });
      return;
    }

    const mailboxName = name?.trim() || conn.email_address.split("@")[0];

    const { data: mailbox, error } = await supabaseAdmin
      .from("shared_mailboxes")
      .insert({
        organisation_id: orgId,
        name: mailboxName,
        email_address: conn.email_address,
        connection_id: conn.id,
        created_by: req.userId!,
      })
      .select()
      .single();

    if (error || !mailbox) {
      console.error("Failed to create shared mailbox:", error);
      res.status(500).json({ error: "Erreur lors de la création" });
      return;
    }

    await supabaseAdmin
      .from("shared_mailbox_members")
      .insert({
        shared_mailbox_id: mailbox.id,
        user_id: req.userId!,
        can_reply: true,
      });

    const { data: backfilledRows, error: bfErr } = await supabaseAdmin
      .from("emails")
      .update({ shared_mailbox_id: mailbox.id })
      .eq("user_id", req.userId!)
      .like("external_id", `${conn.id}:%`)
      .is("shared_mailbox_id", null)
      .select("id");

    if (bfErr) {
      console.error(`[shared-mailboxes] Backfill error:`, bfErr.message);
    } else if (backfilledRows && backfilledRows.length > 0) {
      console.log(`[shared-mailboxes] Backfilled ${backfilledRows.length} existing email(s) for shared mailbox ${mailbox.id}`);
    }

    res.status(201).json({
      id: mailbox.id,
      name: mailbox.name,
      emailAddress: mailbox.email_address,
      connectionId: mailbox.connection_id,
      createdAt: mailbox.created_at,
    });
  } catch {
    res.status(500).json({ error: "Erreur lors de la création de la boîte partagée" });
  }
});

router.delete("/shared-mailboxes/:mailboxId", requireAuth, async (req, res): Promise<void> => {
  try {
    const orgId = await getOrgIdForAdmin(req.userId!);
    if (!orgId) {
      res.status(403).json({ error: "Accès réservé aux administrateurs" });
      return;
    }

    const { data: mb } = await supabaseAdmin
      .from("shared_mailboxes")
      .select("id, organisation_id")
      .eq("id", req.params.mailboxId)
      .single();

    if (!mb || mb.organisation_id !== orgId) {
      res.status(404).json({ error: "Boîte partagée introuvable" });
      return;
    }

    await supabaseAdmin
      .from("shared_mailboxes")
      .delete()
      .eq("id", mb.id);

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Erreur lors de la suppression" });
  }
});

router.get("/shared-mailboxes/:mailboxId/members", requireAuth, async (req, res): Promise<void> => {
  try {
    const orgId = await getOrgIdForMember(req.userId!);
    if (!orgId) {
      res.json([]);
      return;
    }

    const { data: mb } = await supabaseAdmin
      .from("shared_mailboxes")
      .select("id, organisation_id")
      .eq("id", req.params.mailboxId)
      .single();

    if (!mb || mb.organisation_id !== orgId) {
      res.json([]);
      return;
    }

    const { data: members } = await supabaseAdmin
      .from("shared_mailbox_members")
      .select("id, user_id, can_reply, added_at")
      .eq("shared_mailbox_id", mb.id);

    if (!members || members.length === 0) {
      res.json([]);
      return;
    }

    const enriched = [];
    for (const m of members) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("full_name")
        .eq("id", m.user_id)
        .single();

      let email = "";
      try {
        const { data: u } = await supabaseAdmin.auth.admin.getUserById(m.user_id);
        email = u.user?.email || "";
      } catch {}

      enriched.push({
        id: m.id,
        userId: m.user_id,
        fullName: profile?.full_name || "",
        email,
        canReply: m.can_reply,
      });
    }

    res.json(enriched);
  } catch {
    res.status(500).json({ error: "Erreur" });
  }
});

router.post("/shared-mailboxes/:mailboxId/members", requireAuth, async (req, res): Promise<void> => {
  try {
    const orgId = await getOrgIdForAdmin(req.userId!);
    if (!orgId) {
      res.status(403).json({ error: "Accès réservé aux administrateurs" });
      return;
    }

    const { userId, canReply } = req.body;
    if (!userId) {
      res.status(400).json({ error: "userId requis" });
      return;
    }

    const { data: mb } = await supabaseAdmin
      .from("shared_mailboxes")
      .select("id, organisation_id")
      .eq("id", req.params.mailboxId)
      .single();

    if (!mb || mb.organisation_id !== orgId) {
      res.status(404).json({ error: "Boîte partagée introuvable" });
      return;
    }

    const { data: isMember } = await supabaseAdmin
      .from("organisation_members")
      .select("id")
      .eq("organisation_id", orgId)
      .eq("user_id", userId)
      .single();

    if (!isMember) {
      res.status(400).json({ error: "L'utilisateur ne fait pas partie de l'organisation" });
      return;
    }

    const { error } = await supabaseAdmin
      .from("shared_mailbox_members")
      .upsert({
        shared_mailbox_id: mb.id,
        user_id: userId,
        can_reply: canReply !== false,
      }, { onConflict: "shared_mailbox_id,user_id" });

    if (error) {
      res.status(500).json({ error: "Erreur lors de l'ajout" });
      return;
    }

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Erreur lors de l'ajout du membre" });
  }
});

router.delete("/shared-mailboxes/:mailboxId/members/:memberId", requireAuth, async (req, res): Promise<void> => {
  try {
    const orgId = await getOrgIdForAdmin(req.userId!);
    if (!orgId) {
      res.status(403).json({ error: "Accès réservé aux administrateurs" });
      return;
    }

    const { data: mb } = await supabaseAdmin
      .from("shared_mailboxes")
      .select("id, organisation_id")
      .eq("id", req.params.mailboxId)
      .single();

    if (!mb || mb.organisation_id !== orgId) {
      res.status(404).json({ error: "Boîte partagée introuvable" });
      return;
    }

    const { count } = await supabaseAdmin
      .from("shared_mailbox_members")
      .delete({ count: "exact" })
      .eq("id", req.params.memberId)
      .eq("shared_mailbox_id", mb.id);

    if (!count) {
      res.status(404).json({ error: "Membre introuvable" });
      return;
    }

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Erreur lors du retrait" });
  }
});

router.get("/shared-mailboxes/:mailboxId/emails", requireAuth, async (req, res): Promise<void> => {
  try {
    const orgId = await getOrgIdForMember(req.userId!);
    if (!orgId) {
      res.json([]);
      return;
    }

    const { data: isMbMember } = await supabaseAdmin
      .from("shared_mailbox_members")
      .select("id")
      .eq("shared_mailbox_id", req.params.mailboxId)
      .eq("user_id", req.userId!)
      .single();

    if (!isMbMember) {
      res.status(403).json({ error: "Vous n'avez pas accès à cette boîte" });
      return;
    }

    const filter = req.query.filter as string;

    let query = supabaseAdmin
      .from("emails")
      .select("id, sender, subject, body, status, priority, summary, category_id, claimed_by, claimed_at, created_at")
      .eq("shared_mailbox_id", req.params.mailboxId)
      .neq("status", "supprime")
      .order("created_at", { ascending: false })
      .limit(50);

    if (filter === "unclaimed") {
      query = query.is("claimed_by", null);
    } else if (filter === "mine") {
      query = query.eq("claimed_by", req.userId!);
    }

    const { data: emails } = await query;

    if (!emails || emails.length === 0) {
      res.json([]);
      return;
    }

    const claimedByIds = [...new Set(emails.filter(e => e.claimed_by).map(e => e.claimed_by!))];
    const profileMap = new Map<string, string>();

    for (const uid of claimedByIds) {
      const { data: p } = await supabaseAdmin
        .from("profiles")
        .select("full_name")
        .eq("id", uid)
        .single();
      if (p) profileMap.set(uid, p.full_name || "");
    }

    function parseSenderField(raw: string) {
      const match = raw.match(/^(.+?)\s*<(.+?)>$/);
      return {
        name: match ? match[1].trim().replace(/^"|"$/g, "") : raw,
        email: match ? match[2].trim() : raw,
      };
    }

    const enriched = emails.map(e => {
      const s = parseSenderField(e.sender || "");
      return {
        id: e.id,
        sender: s.name,
        senderEmail: s.email,
        subject: e.subject,
        body: e.body,
        status: e.status,
        priority: e.priority,
        summary: e.summary,
        categoryId: e.category_id,
        claimedBy: e.claimed_by,
        claimedByName: e.claimed_by ? profileMap.get(e.claimed_by) || "" : null,
        claimedAt: e.claimed_at,
        createdAt: e.created_at,
      };
    });

    res.json(enriched);
  } catch {
    res.status(500).json({ error: "Erreur lors de la récupération des emails" });
  }
});

router.post("/shared-mailboxes/emails/:emailId/claim", requireAuth, async (req, res): Promise<void> => {
  try {
    const { data: email } = await supabaseAdmin
      .from("emails")
      .select("id, shared_mailbox_id, claimed_by")
      .eq("id", req.params.emailId)
      .single();

    if (!email || !email.shared_mailbox_id) {
      res.status(404).json({ error: "Email introuvable" });
      return;
    }

    if (email.claimed_by && email.claimed_by !== req.userId!) {
      const { data: claimer } = await supabaseAdmin
        .from("profiles")
        .select("full_name")
        .eq("id", email.claimed_by)
        .single();
      res.status(409).json({ error: `Déjà pris en charge par ${claimer?.full_name || "un collègue"}` });
      return;
    }

    const { data: isMember } = await supabaseAdmin
      .from("shared_mailbox_members")
      .select("id")
      .eq("shared_mailbox_id", email.shared_mailbox_id)
      .eq("user_id", req.userId!)
      .single();

    if (!isMember) {
      res.status(403).json({ error: "Vous n'avez pas accès à cette boîte" });
      return;
    }

    await supabaseAdmin
      .from("emails")
      .update({
        claimed_by: req.userId!,
        claimed_at: new Date().toISOString(),
      })
      .eq("id", email.id);

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Erreur" });
  }
});

router.post("/shared-mailboxes/emails/:emailId/unclaim", requireAuth, async (req, res): Promise<void> => {
  try {
    const { data: email } = await supabaseAdmin
      .from("emails")
      .select("id, shared_mailbox_id, claimed_by")
      .eq("id", req.params.emailId)
      .single();

    if (!email || !email.shared_mailbox_id) {
      res.status(404).json({ error: "Email introuvable" });
      return;
    }

    if (email.claimed_by !== req.userId!) {
      res.status(403).json({ error: "Seul le responsable peut relâcher cet email" });
      return;
    }

    await supabaseAdmin
      .from("emails")
      .update({ claimed_by: null, claimed_at: null })
      .eq("id", email.id);

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Erreur" });
  }
});

router.post("/shared-mailboxes/:mailboxId/force-sync", requireAuth, async (req, res): Promise<void> => {
  try {
    const orgId = await getOrgIdForMember(req.userId!);
    if (!orgId) {
      res.status(403).json({ error: "Aucune organisation" });
      return;
    }

    const { data: mailbox } = await supabaseAdmin
      .from("shared_mailboxes")
      .select("id, connection_id, organisation_id")
      .eq("id", req.params.mailboxId)
      .single();

    if (!mailbox || mailbox.organisation_id !== orgId) {
      res.status(404).json({ error: "Boîte partagée introuvable" });
      return;
    }

    const { data: isMember } = await supabaseAdmin
      .from("shared_mailbox_members")
      .select("id")
      .eq("shared_mailbox_id", mailbox.id)
      .eq("user_id", req.userId!)
      .single();

    if (!isMember) {
      res.status(403).json({ error: "Vous n'avez pas accès à cette boîte" });
      return;
    }

    if (!mailbox.connection_id) {
      res.status(400).json({ error: "Aucune connexion email liée à cette boîte" });
      return;
    }

    const { data: backfilledRows, error: bfErr } = await supabaseAdmin
      .from("emails")
      .update({ shared_mailbox_id: mailbox.id })
      .like("external_id", `${mailbox.connection_id}:%`)
      .is("shared_mailbox_id", null)
      .select("id");

    if (bfErr) {
      console.error(`[shared-mailboxes] Force-sync backfill error:`, bfErr.message);
    } else if (backfilledRows && backfilledRows.length > 0) {
      console.log(`[shared-mailboxes] Force-sync backfilled ${backfilledRows.length} email(s) for mailbox ${mailbox.id}`);
    }

    const result = await triggerSyncForConnection(mailbox.connection_id);
    res.json({ success: result.success, synced: result.synced, backfilled: backfilledRows?.length || 0, error: result.error || null });
  } catch {
    res.status(500).json({ error: "Erreur lors de la synchronisation" });
  }
});


export default router;
