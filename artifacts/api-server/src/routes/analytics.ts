import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";
import PDFDocument from "pdfkit";

const router: IRouter = Router();

async function getOrgIdForAdmin(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("organisation_members")
    .select("organisation_id, role")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (!data || (data.role !== "admin" && data.role !== "owner")) return null;
  return data.organisation_id || null;
}

function rangeDays(period: string): number {
  if (period === "7d") return 7;
  if (period === "90d") return 90;
  return 30;
}

function csvEscape(v: any): string {
  const s = v == null ? "" : String(v);
  if (s.includes(",") || s.includes("\"") || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

router.get("/analytics/team", requireAuth, async (req, res): Promise<void> => {
  try {
    const orgId = await getOrgIdForAdmin(req.userId!);
    if (!orgId) {
      res.status(403).json({ error: "forbidden" });
      return;
    }

    const period = String(req.query.period || "30d");
    const days = rangeDays(period);
    const sinceIso = new Date(Date.now() - days * 24 * 60 * 60_000).toISOString();
    const memberFilter = req.query.member ? String(req.query.member) : null;
    const mailboxFilter = req.query.mailbox ? String(req.query.mailbox) : null;
    const projectFilter = req.query.project ? String(req.query.project) : null;

    const { data: members } = await supabaseAdmin
      .from("organisation_members")
      .select("user_id, role")
      .eq("organisation_id", orgId)
      .eq("status", "active");
    const memberIds = (members || []).map((m: any) => m.user_id);

    if (memberIds.length === 0) {
      res.json({ totals: {}, perMember: [], topSenders: [], topCategories: [], evolution: [], slaSummary: {} });
      return;
    }

    // Récupère les boîtes partagées de l'org POUR LE SCOPE EMAIL : un mail
    // arrivé dans une boîte partagée a typiquement un `user_id` qui n'est pas
    // celui d'un membre humain (c'est le user technique de la connexion). On
    // doit donc inclure explicitement les emails dont `shared_mailbox_id`
    // pointe vers une boîte de l'org, en plus des emails persos des membres.
    // Sans ça, toute org qui travaille via boîtes partagées voit l'analytics
    // à 0. Mirror du scope inbox (lib/inbox-scope.ts).
    const { data: orgMailboxes } = await supabaseAdmin
      .from("shared_mailboxes")
      .select("id, name, email_address")
      .eq("organisation_id", orgId);
    const orgMailboxIds = (orgMailboxes || []).map((m: any) => m.id);

    let emailsQ = supabaseAdmin
      .from("emails")
      .select("id, sender, status, assigned_to, claimed_by, category_id, project_id, shared_mailbox_id, created_at, inboria_processed_at, claimed_at, assigned_at, user_id")
      .gte("created_at", sinceIso)
      .neq("status", "supprime");

    // Scope = (emails persos des membres) OU (emails de toute boîte partagée
    // de l'org). Postgrest .or() : un seul appel additif suffit.
    const memberIdsList = memberIds.join(",");
    const scopeParts: string[] = [`user_id.in.(${memberIdsList})`];
    if (orgMailboxIds.length > 0) {
      scopeParts.push(`shared_mailbox_id.in.(${orgMailboxIds.join(",")})`);
    }
    emailsQ = emailsQ.or(scopeParts.join(","));

    if (memberFilter) emailsQ = emailsQ.or(`assigned_to.eq.${memberFilter},claimed_by.eq.${memberFilter}`);
    if (mailboxFilter) emailsQ = emailsQ.eq("shared_mailbox_id", mailboxFilter);
    if (projectFilter) emailsQ = emailsQ.eq("project_id", projectFilter);

    const { data: emails, error: emailsErr } = await emailsQ.limit(20000);
    if (emailsErr) {
      req.log.error({ err: emailsErr }, "analytics emails query failed");
    }
    const list = emails || [];

    // Profiles for member names
    const profileMap = new Map<string, string>();
    for (const uid of memberIds) {
      const { data: p } = await supabaseAdmin.from("profiles").select("full_name").eq("id", uid).single();
      profileMap.set(uid, p?.full_name || "");
    }

    // Categories
    const catIds = [...new Set(list.map((e: any) => e.category_id).filter(Boolean))];
    const catMap = new Map<string, string>();
    if (catIds.length > 0) {
      const { data: cats } = await supabaseAdmin.from("categories").select("id, name").in("id", catIds);
      for (const c of cats || []) catMap.set(c.id, c.name);
    }

    // Per-member stats
    const perMemberMap = new Map<string, { handled: number; archived: number; assigned: number; firstResponseSumMin: number; firstResponseCount: number }>();
    for (const uid of memberIds) {
      perMemberMap.set(uid, { handled: 0, archived: 0, assigned: 0, firstResponseSumMin: 0, firstResponseCount: 0 });
    }

    const senderCounts = new Map<string, number>();
    const categoryCounts = new Map<string, number>();
    const evolutionMap = new Map<string, number>();

    for (const e of list) {
      const ownerId = e.assigned_to || e.claimed_by || null;
      if (ownerId && perMemberMap.has(ownerId)) {
        const stats = perMemberMap.get(ownerId)!;
        stats.handled += 1;
        if (e.status === "archived") stats.archived += 1;
        if (e.assigned_to) stats.assigned += 1;
      }
      const senderEmail = (e.sender || "").match(/<([^>]+)>/)?.[1] || e.sender || "";
      if (senderEmail) {
        senderCounts.set(senderEmail, (senderCounts.get(senderEmail) || 0) + 1);
      }
      if (e.category_id) {
        const name = catMap.get(e.category_id) || "Autre";
        categoryCounts.set(name, (categoryCounts.get(name) || 0) + 1);
      }
      const day = (e.created_at || "").slice(0, 10);
      if (day) evolutionMap.set(day, (evolutionMap.get(day) || 0) + 1);
    }

    // First response time approximation : created_at -> claimed_at|assigned_at|inboria_processed_at
    for (const r of list as any[]) {
      const ownerId = r.assigned_to || r.claimed_by || null;
      if (!ownerId || !perMemberMap.has(ownerId)) continue;
      const handledAt = r.claimed_at || r.assigned_at || r.inboria_processed_at;
      if (!handledAt || !r.created_at) continue;
      const diffMin = Math.max(0, Math.floor((new Date(handledAt).getTime() - new Date(r.created_at).getTime()) / 60_000));
      const stats = perMemberMap.get(ownerId)!;
      stats.firstResponseSumMin += diffMin;
      stats.firstResponseCount += 1;
    }

    const perMember = Array.from(perMemberMap.entries())
      .filter(([uid]) => !memberFilter || uid === memberFilter)
      .map(([uid, s]) => ({
        userId: uid,
        userName: profileMap.get(uid) || "",
        handled: s.handled,
        archived: s.archived,
        assigned: s.assigned,
        avgFirstResponseMinutes: s.firstResponseCount > 0 ? Math.round(s.firstResponseSumMin / s.firstResponseCount) : null,
      }));

    const topSenders = Array.from(senderCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([email, count]) => ({ email, count }));

    const topCategories = Array.from(categoryCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    // Fill gaps in evolution
    const evolution: { date: string; count: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60_000).toISOString().slice(0, 10);
      evolution.push({ date: d, count: evolutionMap.get(d) || 0 });
    }

    // SLA summary — réutilise orgMailboxes déjà récupérées plus haut pour
    // construire le scope email (évite un round-trip Supabase supplémentaire).
    const mbIds = orgMailboxIds;
    const mbMap = new Map<string, { name: string; email: string }>(
      (orgMailboxes || []).map((m: any) => [m.id, { name: m.name || "", email: m.email_address || "" }]),
    );
    let totalBreaches = 0, openBreaches = 0;
    if (mbIds.length > 0) {
      const { count: totalC } = await supabaseAdmin
        .from("sla_breaches")
        .select("id", { count: "exact", head: true })
        .in("shared_mailbox_id", mbIds)
        .gte("detected_at", sinceIso);
      const { count: openC } = await supabaseAdmin
        .from("sla_breaches")
        .select("id", { count: "exact", head: true })
        .in("shared_mailbox_id", mbIds)
        .is("resolved_at", null);
      totalBreaches = totalC || 0;
      openBreaches = openC || 0;
    }

    // Per-mailbox breakdown (count + avg first-response in business minutes
    // approximation = updated_at - created_at for archived emails).
    const perMailboxMap = new Map<string, { count: number; archived: number; respSum: number; respN: number }>();
    for (const e of list as any[]) {
      const mid = e.shared_mailbox_id || "__none__";
      let s = perMailboxMap.get(mid);
      if (!s) { s = { count: 0, archived: 0, respSum: 0, respN: 0 }; perMailboxMap.set(mid, s); }
      s.count += 1;
      if (e.status === "archived") {
        s.archived += 1;
        const handledAt = e.claimed_at || e.assigned_at || e.inboria_processed_at;
        if (e.created_at && handledAt) {
          const d = (new Date(handledAt).getTime() - new Date(e.created_at).getTime()) / 60000;
          if (d > 0 && d < 60 * 24 * 30) { s.respSum += d; s.respN += 1; }
        }
      }
    }
    const perMailbox = Array.from(perMailboxMap.entries()).map(([mid, s]) => {
      const meta = mid === "__none__" ? null : mbMap.get(mid);
      const isPersonal = mid === "__none__";
      return {
        mailboxId: isPersonal ? null : mid,
        mailboxName: isPersonal ? "__personal__" : (meta?.name || "—"),
        mailboxEmail: meta?.email || "",
        count: s.count,
        archived: s.archived,
        avgFirstResponseMinutes: s.respN > 0 ? Math.round(s.respSum / s.respN) : null,
      };
    }).sort((a, b) => b.count - a.count);

    // Per-project breakdown
    const projIds = [...new Set(list.map((e: any) => e.project_id).filter(Boolean))] as string[];
    const projMap = new Map<string, { name: string; reference: string }>();
    if (projIds.length > 0) {
      const { data: prows } = await supabaseAdmin
        .from("projects")
        .select("id, name, reference")
        .in("id", projIds);
      for (const p of prows || []) projMap.set(p.id, { name: p.name || "", reference: p.reference || "" });
    }
    const perProjectMap = new Map<string, { count: number; archived: number; respSum: number; respN: number }>();
    for (const e of list as any[]) {
      if (!e.project_id) continue;
      let s = perProjectMap.get(e.project_id);
      if (!s) { s = { count: 0, archived: 0, respSum: 0, respN: 0 }; perProjectMap.set(e.project_id, s); }
      s.count += 1;
      if (e.status === "archived") {
        s.archived += 1;
        const handledAt = e.claimed_at || e.assigned_at || e.inboria_processed_at;
        if (e.created_at && handledAt) {
          const d = (new Date(handledAt).getTime() - new Date(e.created_at).getTime()) / 60000;
          if (d > 0 && d < 60 * 24 * 30) { s.respSum += d; s.respN += 1; }
        }
      }
    }
    const perProject = Array.from(perProjectMap.entries()).map(([pid, s]) => ({
      projectId: pid,
      projectName: projMap.get(pid)?.name || "",
      projectReference: projMap.get(pid)?.reference || "",
      count: s.count,
      archived: s.archived,
      avgFirstResponseMinutes: s.respN > 0 ? Math.round(s.respSum / s.respN) : null,
    })).sort((a, b) => b.count - a.count);

    res.json({
      totals: {
        emails: list.length,
        archived: list.filter((e: any) => e.status === "archived").length,
        assigned: list.filter((e: any) => !!e.assigned_to).length,
        period,
      },
      filters: { period, member: memberFilter, mailbox: mailboxFilter, project: projectFilter },
      perMember,
      perMailbox,
      perProject,
      topSenders,
      topCategories,
      evolution,
      slaSummary: {
        totalBreaches,
        openBreaches,
      },
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Erreur analytics" });
  }
});

router.get("/analytics/team/export.csv", requireAuth, async (req, res): Promise<void> => {
  try {
    const orgId = await getOrgIdForAdmin(req.userId!);
    if (!orgId) { res.status(403).send("forbidden"); return; }

    const period = String(req.query.period || "30d");
    const days = rangeDays(period);
    const sinceIso = new Date(Date.now() - days * 24 * 60 * 60_000).toISOString();
    const memberFilter = req.query.member ? String(req.query.member) : null;
    const mailboxFilter = req.query.mailbox ? String(req.query.mailbox) : null;
    const projectFilter = req.query.project ? String(req.query.project) : null;

    const { data: members } = await supabaseAdmin
      .from("organisation_members")
      .select("user_id")
      .eq("organisation_id", orgId)
      .eq("status", "active");
    const memberIds = (members || []).map((m: any) => m.user_id);

    const profileMap = new Map<string, string>();
    for (const uid of memberIds) {
      const { data: p } = await supabaseAdmin.from("profiles").select("full_name").eq("id", uid).single();
      profileMap.set(uid, p?.full_name || "");
    }

    // Même scope que /analytics/team : emails persos des membres + emails de
    // toute boîte partagée de l'org (sans cela les exports CSV/PDF des orgs
    // qui travaillent via boîtes partagées seraient vides).
    const { data: csvOrgMailboxes } = await supabaseAdmin
      .from("shared_mailboxes")
      .select("id")
      .eq("organisation_id", orgId);
    const csvOrgMailboxIds = (csvOrgMailboxes || []).map((m: any) => m.id);
    const csvScopeParts: string[] = [`user_id.in.(${memberIds.join(",")})`];
    if (csvOrgMailboxIds.length > 0) {
      csvScopeParts.push(`shared_mailbox_id.in.(${csvOrgMailboxIds.join(",")})`);
    }
    let csvQ = supabaseAdmin
      .from("emails")
      .select("id, subject, sender, status, assigned_to, claimed_by, created_at, claimed_at, assigned_at, inboria_processed_at")
      .or(csvScopeParts.join(","))
      .gte("created_at", sinceIso)
      .neq("status", "supprime");
    if (memberFilter) csvQ = csvQ.or(`assigned_to.eq.${memberFilter},claimed_by.eq.${memberFilter}`);
    if (mailboxFilter) csvQ = csvQ.eq("shared_mailbox_id", mailboxFilter);
    if (projectFilter) csvQ = csvQ.eq("project_id", projectFilter);
    const { data: list } = await csvQ.limit(20000);

    const lines: string[] = [
      ["email_id", "subject", "sender", "status", "assigned_to", "owner_name", "created_at", "handled_at"].join(","),
    ];
    for (const e of list || []) {
      const ownerId = e.assigned_to || e.claimed_by || "";
      lines.push([
        csvEscape(e.id),
        csvEscape(e.subject),
        csvEscape(e.sender),
        csvEscape(e.status),
        csvEscape(ownerId),
        csvEscape(profileMap.get(ownerId) || ""),
        csvEscape(e.created_at),
        csvEscape(e.claimed_at || e.assigned_at || e.inboria_processed_at || ""),
      ].join(","));
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="inboria-team-${period}.csv"`);
    res.send(lines.join("\n"));
  } catch {
    res.status(500).send("export error");
  }
});

router.get("/analytics/team/export.pdf", requireAuth, async (req, res): Promise<void> => {
  try {
    const orgId = await getOrgIdForAdmin(req.userId!);
    if (!orgId) { res.status(403).send("forbidden"); return; }

    const period = String(req.query.period || "30d");
    const days = rangeDays(period);
    const sinceIso = new Date(Date.now() - days * 24 * 60 * 60_000).toISOString();
    const memberFilter = req.query.member ? String(req.query.member) : null;
    const mailboxFilter = req.query.mailbox ? String(req.query.mailbox) : null;
    const projectFilter = req.query.project ? String(req.query.project) : null;

    const { data: members } = await supabaseAdmin
      .from("organisation_members")
      .select("user_id")
      .eq("organisation_id", orgId)
      .eq("status", "active");
    const memberIds = (members || []).map((m: any) => m.user_id);

    const profileMap = new Map<string, string>();
    for (const uid of memberIds) {
      const { data: p } = await supabaseAdmin.from("profiles").select("full_name").eq("id", uid).single();
      profileMap.set(uid, p?.full_name || "");
    }

    // Même scope que /analytics/team : emails persos des membres + emails de
    // toute boîte partagée de l'org.
    const { data: pdfOrgMailboxes } = await supabaseAdmin
      .from("shared_mailboxes")
      .select("id")
      .eq("organisation_id", orgId);
    const pdfOrgMailboxIds = (pdfOrgMailboxes || []).map((m: any) => m.id);
    const pdfScopeParts: string[] = [`user_id.in.(${memberIds.join(",")})`];
    if (pdfOrgMailboxIds.length > 0) {
      pdfScopeParts.push(`shared_mailbox_id.in.(${pdfOrgMailboxIds.join(",")})`);
    }
    let pdfQ = supabaseAdmin
      .from("emails")
      .select("id, status, assigned_to, claimed_by, created_at")
      .or(pdfScopeParts.join(","))
      .gte("created_at", sinceIso)
      .neq("status", "supprime");
    if (memberFilter) pdfQ = pdfQ.or(`assigned_to.eq.${memberFilter},claimed_by.eq.${memberFilter}`);
    if (mailboxFilter) pdfQ = pdfQ.eq("shared_mailbox_id", mailboxFilter);
    if (projectFilter) pdfQ = pdfQ.eq("project_id", projectFilter);
    const { data: list } = await pdfQ.limit(20000);

    const stats = new Map<string, { handled: number; archived: number; assigned: number }>();
    for (const uid of memberIds) stats.set(uid, { handled: 0, archived: 0, assigned: 0 });
    for (const e of (list || []) as any[]) {
      const ownerId = e.assigned_to || e.claimed_by || null;
      if (e.assigned_to && stats.has(e.assigned_to)) {
        stats.get(e.assigned_to)!.assigned += 1;
      }
      if (!ownerId || !stats.has(ownerId)) continue;
      const s = stats.get(ownerId)!;
      s.handled += 1;
      if (e.status === "archived") s.archived += 1;
    }

    // Server-rendered binary PDF (real PDF, not HTML).
    const doc = new PDFDocument({ size: "A4", margin: 48, info: { Title: `Inboria — Bilan équipe ${period}` } });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="inboria-team-${period}.pdf"`);
    doc.pipe(res);

    doc.fontSize(20).fillColor("#0f172a").text("Inboria — Bilan équipe", { align: "left" });
    doc.moveDown(0.2);
    doc
      .fontSize(11)
      .fillColor("#475569")
      .text(`Période : ${period} · Généré le ${new Date().toLocaleString()}`);
    doc.moveDown(0.2);
    doc.fontSize(11).fillColor("#475569").text(`Total emails : ${(list || []).length}`);
    doc.moveDown(1);

    // Table header
    const tableTop = doc.y;
    const colX = [48, 240, 340, 420, 500];
    const headers = ["Membre", "Traités", "Archivés", "Assignés"];
    doc.fontSize(11).fillColor("#0f172a");
    headers.forEach((h, i) => doc.text(h, colX[i], tableTop));
    doc
      .moveTo(48, tableTop + 16)
      .lineTo(560, tableTop + 16)
      .strokeColor("#cbd5e1")
      .stroke();

    let y = tableTop + 22;
    doc.fontSize(10).fillColor("#1e293b");
    for (const [uid, s] of stats.entries()) {
      const name = profileMap.get(uid) || uid.slice(0, 8);
      doc.text(name, colX[0], y, { width: 180, ellipsis: true });
      doc.text(String(s.handled), colX[1], y);
      doc.text(String(s.archived), colX[2], y);
      doc.text(String(s.assigned), colX[3], y);
      y += 18;
      if (y > 770) {
        doc.addPage();
        y = 60;
      }
    }

    doc.moveDown(3);
    doc.fontSize(8).fillColor("#64748b").text(
      "Document généré par Inboria. Données issues de votre organisation.",
      48,
      Math.min(y + 16, 800),
    );

    doc.end();
  } catch (e) {
    if (!res.headersSent) res.status(500).send("export error");
  }
});

export default router;
