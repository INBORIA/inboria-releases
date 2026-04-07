import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";
import crypto from "crypto";

const router: IRouter = Router();

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

router.get("/organisations/mine", requireAuth, async (req, res): Promise<void> => {
  try {
    const { data: membership } = await supabaseAdmin
      .from("organisation_members")
      .select("organisation_id, role")
      .eq("user_id", req.userId!)
      .eq("status", "active")
      .single();

    if (!membership) {
      res.json(null);
      return;
    }

    const { data: org } = await supabaseAdmin
      .from("organisations")
      .select("*")
      .eq("id", membership.organisation_id)
      .single();

    if (!org) {
      res.json(null);
      return;
    }

    res.json({
      id: org.id,
      name: org.name,
      slug: org.slug,
      plan: org.plan,
      seatsTotal: org.seats_total,
      emailsQuota: org.emails_quota,
      emailsUsed: org.emails_used,
      myRole: membership.role,
      createdAt: org.created_at,
    });
  } catch {
    res.status(500).json({ error: "Erreur lors de la récupération de l'organisation" });
  }
});

router.post("/organisations", requireAuth, async (req, res): Promise<void> => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== "string" || name.trim().length < 2) {
      res.status(400).json({ error: "Nom d'organisation requis (min 2 caractères)" });
      return;
    }

    const { data: existing } = await supabaseAdmin
      .from("organisation_members")
      .select("id")
      .eq("user_id", req.userId!)
      .eq("status", "active")
      .single();

    if (existing) {
      res.status(409).json({ error: "Vous faites déjà partie d'une organisation" });
      return;
    }

    const baseSlug = generateSlug(name.trim());
    const slug = `${baseSlug}-${Date.now().toString(36)}`;

    const { data: org, error: orgError } = await supabaseAdmin
      .from("organisations")
      .insert({
        name: name.trim(),
        slug,
        plan: "business",
        seats_total: 3,
        emails_quota: 30000,
        emails_used: 0,
        created_by: req.userId!,
      })
      .select()
      .single();

    if (orgError || !org) {
      console.error("Failed to create organisation:", orgError);
      res.status(500).json({ error: "Erreur lors de la création" });
      return;
    }

    await supabaseAdmin
      .from("organisation_members")
      .insert({
        organisation_id: org.id,
        user_id: req.userId!,
        role: "admin",
        status: "active",
      });

    await supabaseAdmin
      .from("profiles")
      .update({ organisation_id: org.id, plan: "business" })
      .eq("id", req.userId!);

    res.status(201).json({
      id: org.id,
      name: org.name,
      slug: org.slug,
      plan: org.plan,
      seatsTotal: org.seats_total,
      myRole: "admin",
    });
  } catch {
    res.status(500).json({ error: "Erreur lors de la création de l'organisation" });
  }
});

router.patch("/organisations", requireAuth, async (req, res): Promise<void> => {
  try {
    const { data: membership } = await supabaseAdmin
      .from("organisation_members")
      .select("organisation_id, role")
      .eq("user_id", req.userId!)
      .eq("status", "active")
      .eq("role", "admin")
      .single();

    if (!membership) {
      res.status(403).json({ error: "Accès réservé aux administrateurs" });
      return;
    }

    const { name } = req.body;
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name && typeof name === "string") updates.name = name.trim();

    const { data: org, error } = await supabaseAdmin
      .from("organisations")
      .update(updates)
      .eq("id", membership.organisation_id)
      .select()
      .single();

    if (error || !org) {
      res.status(500).json({ error: "Erreur lors de la mise à jour" });
      return;
    }

    res.json({
      id: org.id,
      name: org.name,
      slug: org.slug,
      plan: org.plan,
      seatsTotal: org.seats_total,
    });
  } catch {
    res.status(500).json({ error: "Erreur lors de la mise à jour de l'organisation" });
  }
});

router.get("/organisations/members", requireAuth, async (req, res): Promise<void> => {
  try {
    const { data: membership } = await supabaseAdmin
      .from("organisation_members")
      .select("organisation_id")
      .eq("user_id", req.userId!)
      .eq("status", "active")
      .single();

    if (!membership) {
      res.json([]);
      return;
    }

    const { data: members } = await supabaseAdmin
      .from("organisation_members")
      .select("id, user_id, role, status, joined_at")
      .eq("organisation_id", membership.organisation_id)
      .order("joined_at", { ascending: true });

    if (!members || members.length === 0) {
      res.json([]);
      return;
    }

    const userIds = members.map((m) => m.user_id);
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

    const enriched = [];
    for (const m of members) {
      const profile = profileMap.get(m.user_id);

      let email = "";
      try {
        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(m.user_id);
        email = userData.user?.email || "";
      } catch {}

      enriched.push({
        id: m.id,
        userId: m.user_id,
        role: m.role,
        status: m.status,
        joinedAt: m.joined_at,
        fullName: profile?.full_name || "",
        email,
      });
    }

    res.json(enriched);
  } catch {
    res.status(500).json({ error: "Erreur lors de la récupération des membres" });
  }
});

router.delete("/organisations/members/:memberId", requireAuth, async (req, res): Promise<void> => {
  try {
    const { data: adminMembership } = await supabaseAdmin
      .from("organisation_members")
      .select("organisation_id, role")
      .eq("user_id", req.userId!)
      .eq("status", "active")
      .eq("role", "admin")
      .single();

    if (!adminMembership) {
      res.status(403).json({ error: "Accès réservé aux administrateurs" });
      return;
    }

    const { data: target } = await supabaseAdmin
      .from("organisation_members")
      .select("id, user_id, organisation_id")
      .eq("id", req.params.memberId)
      .single();

    if (!target || target.organisation_id !== adminMembership.organisation_id) {
      res.status(404).json({ error: "Membre introuvable" });
      return;
    }

    if (target.user_id === req.userId!) {
      res.status(400).json({ error: "Vous ne pouvez pas vous retirer vous-même" });
      return;
    }

    await supabaseAdmin
      .from("organisation_members")
      .delete()
      .eq("id", target.id);

    await supabaseAdmin
      .from("profiles")
      .update({ organisation_id: null, plan: "expired" })
      .eq("id", target.user_id);

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Erreur lors du retrait du membre" });
  }
});

router.patch("/organisations/members/:memberId/role", requireAuth, async (req, res): Promise<void> => {
  try {
    const { role } = req.body;
    if (!role || !["admin", "member"].includes(role)) {
      res.status(400).json({ error: "Rôle invalide" });
      return;
    }

    const { data: adminMembership } = await supabaseAdmin
      .from("organisation_members")
      .select("organisation_id, role")
      .eq("user_id", req.userId!)
      .eq("status", "active")
      .eq("role", "admin")
      .single();

    if (!adminMembership) {
      res.status(403).json({ error: "Accès réservé aux administrateurs" });
      return;
    }

    const { data: target } = await supabaseAdmin
      .from("organisation_members")
      .select("id, organisation_id, user_id")
      .eq("id", req.params.memberId)
      .single();

    if (!target || target.organisation_id !== adminMembership.organisation_id) {
      res.status(404).json({ error: "Membre introuvable" });
      return;
    }

    if (target.user_id === req.userId!) {
      res.status(400).json({ error: "Vous ne pouvez pas changer votre propre rôle" });
      return;
    }

    const { data: updated } = await supabaseAdmin
      .from("organisation_members")
      .update({ role })
      .eq("id", target.id)
      .select()
      .single();

    res.json({ id: updated?.id, role: updated?.role });
  } catch {
    res.status(500).json({ error: "Erreur lors du changement de rôle" });
  }
});

router.post("/organisations/invite", requireAuth, async (req, res): Promise<void> => {
  try {
    const { email, role } = req.body;
    if (!email || typeof email !== "string") {
      res.status(400).json({ error: "Email requis" });
      return;
    }

    const inviteRole = role === "admin" ? "admin" : "member";

    const { data: adminMembership } = await supabaseAdmin
      .from("organisation_members")
      .select("organisation_id, role")
      .eq("user_id", req.userId!)
      .eq("status", "active")
      .eq("role", "admin")
      .single();

    if (!adminMembership) {
      res.status(403).json({ error: "Accès réservé aux administrateurs" });
      return;
    }

    const { data: org } = await supabaseAdmin
      .from("organisations")
      .select("seats_total")
      .eq("id", adminMembership.organisation_id)
      .single();

    const { count: memberCount } = await supabaseAdmin
      .from("organisation_members")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", adminMembership.organisation_id);

    if (org && memberCount !== null && memberCount >= org.seats_total) {
      res.status(400).json({ error: `Limite de ${org.seats_total} sièges atteinte. Augmentez votre nombre de sièges.` });
      return;
    }

    const { data: existingInvite } = await supabaseAdmin
      .from("invitations")
      .select("id")
      .eq("organisation_id", adminMembership.organisation_id)
      .eq("email", email.toLowerCase().trim())
      .eq("status", "pending")
      .single();

    if (existingInvite) {
      res.status(409).json({ error: "Une invitation est déjà en attente pour cet email" });
      return;
    }

    const { data: existingMember } = await supabaseAdmin
      .from("organisation_members")
      .select("id, user_id")
      .eq("organisation_id", adminMembership.organisation_id);

    if (existingMember) {
      for (const m of existingMember) {
        try {
          const { data: u } = await supabaseAdmin.auth.admin.getUserById(m.user_id);
          if (u.user?.email?.toLowerCase() === email.toLowerCase().trim()) {
            res.status(409).json({ error: "Cet utilisateur fait déjà partie de l'organisation" });
            return;
          }
        } catch {}
      }
    }

    const token = generateToken();

    const { data: invitation, error } = await supabaseAdmin
      .from("invitations")
      .insert({
        organisation_id: adminMembership.organisation_id,
        email: email.toLowerCase().trim(),
        invited_by: req.userId!,
        role: inviteRole,
        token,
        status: "pending",
      })
      .select()
      .single();

    if (error || !invitation) {
      console.error("Failed to create invitation:", error);
      res.status(500).json({ error: "Erreur lors de l'envoi de l'invitation" });
      return;
    }

    const { data: orgData } = await supabaseAdmin
      .from("organisations")
      .select("name")
      .eq("id", adminMembership.organisation_id)
      .single();
    const orgName = orgData?.name || "votre organisation";

    const frontendUrl = process.env["FRONTEND_URL"] || `https://${process.env["REPLIT_DEV_DOMAIN"] || "ncvmail.com"}`;
    const acceptUrl = `${frontendUrl}/accept-invite?token=${token}`;

    try {
      const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
      const userExists = existingUser?.users?.some(
        (u: any) => u.email?.toLowerCase() === email.toLowerCase().trim()
      );

      if (!userExists) {
        await supabaseAdmin.auth.admin.inviteUserByEmail(email.toLowerCase().trim(), {
          redirectTo: acceptUrl,
          data: { invitation_token: token, org_name: orgName },
        });
      } else {
        await supabaseAdmin.auth.admin.generateLink({
          type: "magiclink",
          email: email.toLowerCase().trim(),
          options: { redirectTo: acceptUrl },
        });
      }
    } catch (emailErr) {
      console.error("Failed to send invitation email (invitation saved):", emailErr);
    }

    res.status(201).json({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      token: invitation.token,
      expiresAt: invitation.expires_at,
    });
  } catch {
    res.status(500).json({ error: "Erreur lors de l'envoi de l'invitation" });
  }
});

router.get("/organisations/invitations", requireAuth, async (req, res): Promise<void> => {
  try {
    const { data: membership } = await supabaseAdmin
      .from("organisation_members")
      .select("organisation_id")
      .eq("user_id", req.userId!)
      .eq("status", "active")
      .single();

    if (!membership) {
      res.json([]);
      return;
    }

    const { data: invitations } = await supabaseAdmin
      .from("invitations")
      .select("id, email, role, status, created_at, expires_at")
      .eq("organisation_id", membership.organisation_id)
      .order("created_at", { ascending: false });

    res.json(invitations || []);
  } catch {
    res.status(500).json({ error: "Erreur lors de la récupération des invitations" });
  }
});

router.delete("/organisations/invitations/:invitationId", requireAuth, async (req, res): Promise<void> => {
  try {
    const { data: adminMembership } = await supabaseAdmin
      .from("organisation_members")
      .select("organisation_id")
      .eq("user_id", req.userId!)
      .eq("status", "active")
      .eq("role", "admin")
      .single();

    if (!adminMembership) {
      res.status(403).json({ error: "Accès réservé aux administrateurs" });
      return;
    }

    await supabaseAdmin
      .from("invitations")
      .delete()
      .eq("id", req.params.invitationId)
      .eq("organisation_id", adminMembership.organisation_id);

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Erreur lors de l'annulation de l'invitation" });
  }
});

router.get("/invitations/:token", async (req, res): Promise<void> => {
  try {
    const { data: invitation } = await supabaseAdmin
      .from("invitations")
      .select("id, email, role, status, expires_at, organisation_id")
      .eq("token", req.params.token)
      .single();

    if (!invitation) {
      res.status(404).json({ error: "Invitation introuvable" });
      return;
    }

    if (invitation.status !== "pending") {
      res.status(400).json({ error: "Cette invitation a déjà été utilisée" });
      return;
    }

    const expiresAt = new Date(invitation.expires_at);
    if (expiresAt < new Date()) {
      await supabaseAdmin
        .from("invitations")
        .update({ status: "expired" })
        .eq("id", invitation.id);
      res.status(400).json({ error: "Cette invitation a expiré" });
      return;
    }

    const { data: org } = await supabaseAdmin
      .from("organisations")
      .select("name")
      .eq("id", invitation.organisation_id)
      .single();

    res.json({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      organisationName: org?.name || "",
    });
  } catch {
    res.status(500).json({ error: "Erreur lors de la vérification de l'invitation" });
  }
});

router.post("/invitations/:token/accept", requireAuth, async (req, res): Promise<void> => {
  try {
    const { data: invitation } = await supabaseAdmin
      .from("invitations")
      .select("*")
      .eq("token", req.params.token)
      .eq("status", "pending")
      .single();

    if (!invitation) {
      res.status(404).json({ error: "Invitation introuvable ou déjà utilisée" });
      return;
    }

    const expiresAt = new Date(invitation.expires_at);
    if (expiresAt < new Date()) {
      await supabaseAdmin
        .from("invitations")
        .update({ status: "expired" })
        .eq("id", invitation.id);
      res.status(400).json({ error: "Cette invitation a expiré" });
      return;
    }

    const token = req.headers.authorization!.slice(7);
    const { data: userData } = await supabaseAdmin.auth.getUser(token);
    const userEmail = userData.user?.email?.toLowerCase() || "";

    if (userEmail !== invitation.email.toLowerCase()) {
      res.status(403).json({
        error: `Cette invitation est destinée à ${invitation.email}. Connectez-vous avec ce compte.`,
      });
      return;
    }

    const { data: existingMembership } = await supabaseAdmin
      .from("organisation_members")
      .select("id")
      .eq("user_id", req.userId!)
      .eq("status", "active")
      .single();

    if (existingMembership) {
      res.status(409).json({ error: "Vous faites déjà partie d'une organisation" });
      return;
    }

    await supabaseAdmin
      .from("organisation_members")
      .insert({
        organisation_id: invitation.organisation_id,
        user_id: req.userId!,
        role: invitation.role,
        status: "active",
      });

    await supabaseAdmin
      .from("profiles")
      .update({ organisation_id: invitation.organisation_id, plan: "business" })
      .eq("id", req.userId!);

    await supabaseAdmin
      .from("invitations")
      .update({ status: "accepted" })
      .eq("id", invitation.id);

    res.json({ success: true, organisationId: invitation.organisation_id });
  } catch {
    res.status(500).json({ error: "Erreur lors de l'acceptation de l'invitation" });
  }
});

export default router;
