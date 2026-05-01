import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";
import { getOrgIdForOrgAdmin, getOrgIdForMember } from "../lib/org-admin";

const router: IRouter = Router();

// Task #176 — Journal d'accès admin → dossier d'un coéquipier.
//
// Modes :
//   ?scope=mine (défaut) : tout membre voit les consultations dont il a été
//     la cible (target_value = adresse email du membre OU consultations
//     d'overview de l'org dont il est membre).
//   ?scope=org : admin org seulement, voit toutes les consultations admin
//     de son organisation.
router.get("/admin/team-access-log", requireAuth, async (req, res): Promise<void> => {
  try {
    const scope = String(req.query.scope || "mine");
    const limit = Math.min(200, Math.max(1, parseInt((req.query.limit as string) || "50", 10)));

    if (scope === "org") {
      const orgId = await getOrgIdForOrgAdmin(req.userId!);
      if (!orgId) {
        res.status(403).json({ error: "Réservé aux administrateurs de l'organisation." });
        return;
      }
      const { data, error } = await supabaseAdmin
        .from("admin_team_access_log")
        .select("id, organisation_id, admin_user_id, target_user_id, target_type, target_value, emails_seen_count, action, created_at")
        .eq("organisation_id", orgId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) {
        req.log?.error({ err: error.message, code: (error as any).code, scope: "org" }, "[team-access-log] org query failed");
        res.status(500).json({ error: error.message });
        return;
      }
      // Resolve admin + target identities (name + email) for display.
      const allIds = new Set<string>();
      for (const r of data || []) {
        if ((r as any).admin_user_id) allIds.add(String((r as any).admin_user_id));
        if ((r as any).target_user_id) allIds.add(String((r as any).target_user_id));
      }
      const profMap = new Map<string, { name: string; email: string }>();
      if (allIds.size) {
        const { data: profs } = await supabaseAdmin
          .from("profiles")
          .select("id, full_name, email")
          .in("id", Array.from(allIds));
        for (const p of profs || []) {
          profMap.set(String((p as any).id), {
            name: (p as any).full_name || "",
            email: (p as any).email || "",
          });
        }
      }
      res.json({
        scope: "org",
        entries: (data || []).map((r: any) => {
          const admin = profMap.get(String(r.admin_user_id));
          const target = r.target_user_id ? profMap.get(String(r.target_user_id)) : null;
          return {
            id: r.id,
            adminUserId: r.admin_user_id,
            adminName: admin?.name || "",
            adminEmail: admin?.email || "",
            targetUserId: r.target_user_id,
            targetName: target?.name || "",
            targetEmail: target?.email || r.target_value || "",
            targetType: r.target_type,
            targetValue: r.target_value,
            emailsSeenCount: r.emails_seen_count,
            action: r.action,
            createdAt: r.created_at,
          };
        }),
      });
      return;
    }

    // Default: "mine" — show consultations where this user is the data subject.
    const orgId = await getOrgIdForMember(req.userId!);
    if (!orgId) {
      res.json({ scope: "mine", entries: [] });
      return;
    }
    // The user's own email addresses (personal inbox owners they could be a target of)
    const { data: conns } = await supabaseAdmin
      .from("email_connections")
      .select("email_address")
      .eq("user_id", req.userId!);
    const myAddresses = (conns || [])
      .map((c: any) => String(c.email_address || "").toLowerCase())
      .filter(Boolean);

    // Pull recent org rows then filter in app: rows that target one of my
    // addresses, OR aggregated overview rows for my org (admin saw the
    // contact list which contained my correspondants).
    const { data, error } = await supabaseAdmin
      .from("admin_team_access_log")
      .select("id, organisation_id, admin_user_id, target_user_id, target_type, target_value, emails_seen_count, action, created_at")
      .eq("organisation_id", orgId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      req.log?.error({ err: error.message, code: (error as any).code, scope: "mine" }, "[team-access-log] mine query failed");
      res.status(500).json({ error: error.message });
      return;
    }
    // Per-member pivot contract: a row "is about me" when its target_user_id
    // matches my user id (strict, new writes), OR — for legacy rows written
    // before target_user_id existed — when target_value matches one of my
    // connected email addresses (or my user id used as fallback when an
    // owner had no email_connection). target_type='inbox_overview' is an
    // org-wide aggregate (no specific member targeted) and is intentionally
    // excluded from /scope=mine to keep the journal informative.
    const myKeys = new Set<string>([
      ...myAddresses,
      String(req.userId!).toLowerCase(),
    ]);
    const filtered = (data || []).filter((r: any) => {
      if (r.target_user_id && String(r.target_user_id) === String(req.userId)) return true;
      if (r.target_type === "member_inbox") {
        return r.target_value && myKeys.has(String(r.target_value).toLowerCase());
      }
      // Legacy/explicit per-target rows (e.g. a contact targeting me directly)
      return r.target_value && myAddresses.includes(String(r.target_value).toLowerCase());
    }).slice(0, limit);

    const adminIds = Array.from(new Set(filtered.map((r: any) => r.admin_user_id).filter(Boolean)));
    const nameMap = new Map<string, string>();
    if (adminIds.length) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name")
        .in("id", adminIds);
      for (const p of profs || []) nameMap.set(String(p.id), (p as any).full_name || "");
    }
    res.json({
      scope: "mine",
      entries: filtered.map((r: any) => ({
        id: r.id,
        adminUserId: r.admin_user_id,
        adminName: nameMap.get(String(r.admin_user_id)) || "",
        targetType: r.target_type,
        targetValue: r.target_value,
        emailsSeenCount: r.emails_seen_count,
        action: r.action,
        createdAt: r.created_at,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to load access log" });
  }
});

// Task #176 — List my own private emails (so I can review what's hidden).
router.get("/me/private-emails", requireAuth, async (req, res): Promise<void> => {
  try {
    const limit = Math.min(200, Math.max(1, parseInt((req.query.limit as string) || "50", 10)));
    const { data, error } = await supabaseAdmin
      .from("emails")
      .select("id, sender, subject, created_at")
      .eq("user_id", req.userId!)
      .eq("is_private", true)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({
      entries: (data || []).map((r: any) => ({
        id: r.id,
        sender: r.sender,
        subject: r.subject,
        createdAt: r.created_at,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to load private emails" });
  }
});

export default router;
