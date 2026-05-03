import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";
import { hasHandledColumns } from "../lib/schema-flags";
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
    const handledEnabled = await hasHandledColumns();

    const { data: members } = await supabaseAdmin
      .from("organisation_members")
      .select("user_id, role")
      .eq("organisation_id", orgId)
      .eq("status", "active");
    const memberIds = (members || []).map((m: any) => m.user_id);

    if (memberIds.length === 0) {
      res.json({ totals: {}, perMember: [], topSenders: [], topCategories: [], evolution: [], slaSummary: {}, handledMetricsEnabled: handledEnabled });
      return;
    }

    const { data: orgMailboxes } = await supabaseAdmin
      .from("shared_mailboxes")
      .select("id, name, email_address")
      .eq("organisation_id", orgId);
    const orgMailboxIds = (orgMailboxes || []).map((m: any) => m.id);

    // Sélection : on ajoute handled_at / handled_by si la colonne existe.
    const baseCols = "id, sender, status, assigned_to, claimed_by, category_id, project_id, shared_mailbox_id, created_at, inboria_processed_at, claimed_at, assigned_at, user_id";
    const cols = handledEnabled ? `${baseCols}, handled_at, handled_by` : baseCols;
    let emailsQ = supabaseAdmin
      .from("emails")
      .select(cols)
      .gte("created_at", sinceIso)
      .neq("status", "supprime");

    const memberIdsList = memberIds.join(",");
    const scopeParts: string[] = [`user_id.in.(${memberIdsList})`];
    if (orgMailboxIds.length > 0) {
      scopeParts.push(`shared_mailbox_id.in.(${orgMailboxIds.join(",")})`);
    }
    emailsQ = emailsQ.or(scopeParts.join(","));

    if (memberFilter) {
      // Filtre membre = "emails que ce membre a traités" (handled_by) si la
      // colonne existe ; sinon fallback sur l'ancienne logique.
      if (handledEnabled) emailsQ = emailsQ.eq("handled_by", memberFilter);
      else emailsQ = emailsQ.or(`assigned_to.eq.${memberFilter},claimed_by.eq.${memberFilter}`);
    }
    if (mailboxFilter) emailsQ = emailsQ.eq("shared_mailbox_id", mailboxFilter);
    if (projectFilter) emailsQ = emailsQ.eq("project_id", projectFilter);

    const { data: emails, error: emailsErr } = await emailsQ.limit(20000);
    if (emailsErr) {
      req.log.error({ err: emailsErr }, "analytics emails query failed");
    }
    const list = emails || [];

    const profileMap = new Map<string, string>();
    for (const uid of memberIds) {
      const { data: p } = await supabaseAdmin.from("profiles").select("full_name").eq("id", uid).single();
      profileMap.set(uid, p?.full_name || "");
    }

    const catIds = [...new Set(list.map((e: any) => e.category_id).filter(Boolean))];
    const catMap = new Map<string, string>();
    if (catIds.length > 0) {
      const { data: cats } = await supabaseAdmin.from("categories").select("id, name").in("id", catIds);
      for (const c of cats || []) catMap.set(c.id, c.name);
    }

    // Per-member : Traités basés sur handled_by si dispo, sinon fallback.
    const perMemberMap = new Map<string, { handled: number; archived: number; assigned: number; firstResponseSumMin: number; firstResponseCount: number }>();
    for (const uid of memberIds) {
      perMemberMap.set(uid, { handled: 0, archived: 0, assigned: 0, firstResponseSumMin: 0, firstResponseCount: 0 });
    }

    const senderCounts = new Map<string, number>();
    const categoryCounts = new Map<string, number>();
    const evolutionMap = new Map<string, number>();
    const evolutionHandledMap = new Map<string, number>();
    let totalHandled = 0;
    let handlingDelaySumMin = 0;
    let handlingDelayCount = 0;

    for (const e of list as any[]) {
      // Compteur "Traités" : handled_by si dispo, sinon ancien proxy.
      const handlerId = handledEnabled ? (e.handled_at ? e.handled_by : null) : (e.assigned_to || e.claimed_by || null);
      if (handlerId && perMemberMap.has(handlerId)) {
        const stats = perMemberMap.get(handlerId)!;
        stats.handled += 1;
      }
      // "Écartés" (archived) imputé au gestionnaire si connu, sinon au
      // claimed_by/assigned_to (sinon perdu — peu d'incidence).
      const fallbackOwner = e.assigned_to || e.claimed_by || null;
      if (e.status === "archived") {
        const archOwner = handlerId || fallbackOwner;
        if (archOwner && perMemberMap.has(archOwner)) {
          perMemberMap.get(archOwner)!.archived += 1;
        }
      }
      if (e.assigned_to && perMemberMap.has(e.assigned_to)) {
        perMemberMap.get(e.assigned_to)!.assigned += 1;
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

      // Évolution "Traités/jour" et délai moyen de traitement.
      // En mode legacy (handled_at/handled_by absents), on bascule sur le
      // proxy historique : claimed_at || assigned_at || inboria_processed_at
      // comme date de traitement, et claimed_by || assigned_to comme acteur.
      const handledTs = handledEnabled
        ? e.handled_at
        : (e.claimed_at || e.assigned_at || e.inboria_processed_at);
      if (handledTs) {
        totalHandled += 1;
        const handledDay = String(handledTs).slice(0, 10);
        if (handledDay) evolutionHandledMap.set(handledDay, (evolutionHandledMap.get(handledDay) || 0) + 1);
        if (e.created_at) {
          const diffMin = Math.max(0, Math.floor((new Date(handledTs).getTime() - new Date(e.created_at).getTime()) / 60_000));
          if (diffMin >= 0 && diffMin < 60 * 24 * 30) {
            handlingDelaySumMin += diffMin;
            handlingDelayCount += 1;
          }
        }
      }
    }

    // Délai moyen de réponse par membre = handled_at - created_at si dispo.
    for (const r of list as any[]) {
      if (handledEnabled) {
        if (!r.handled_at || !r.handled_by || !perMemberMap.has(r.handled_by) || !r.created_at) continue;
        const diffMin = Math.max(0, Math.floor((new Date(r.handled_at).getTime() - new Date(r.created_at).getTime()) / 60_000));
        if (diffMin >= 60 * 24 * 30) continue;
        const stats = perMemberMap.get(r.handled_by)!;
        stats.firstResponseSumMin += diffMin;
        stats.firstResponseCount += 1;
      } else {
        const ownerId = r.assigned_to || r.claimed_by || null;
        if (!ownerId || !perMemberMap.has(ownerId)) continue;
        const handledAt = r.claimed_at || r.assigned_at || r.inboria_processed_at;
        if (!handledAt || !r.created_at) continue;
        const diffMin = Math.max(0, Math.floor((new Date(handledAt).getTime() - new Date(r.created_at).getTime()) / 60_000));
        const stats = perMemberMap.get(ownerId)!;
        stats.firstResponseSumMin += diffMin;
        stats.firstResponseCount += 1;
      }
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

    const evolution: { date: string; count: number; handledCount: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60_000).toISOString().slice(0, 10);
      evolution.push({
        date: d,
        count: evolutionMap.get(d) || 0,
        handledCount: handledEnabled ? (evolutionHandledMap.get(d) || 0) : 0,
      });
    }

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

    // Per-mailbox : "count" devient "Traités" quand handledEnabled, sinon
    // c'est le volume reçu (rétro-compat). On garde le champ `count` pour
    // ne pas casser le frontend, et on ajoute `handled` séparé.
    const perMailboxMap = new Map<string, { count: number; handled: number; archived: number; respSum: number; respN: number }>();
    for (const e of list as any[]) {
      if (!e.shared_mailbox_id) continue;
      const mid = e.shared_mailbox_id;
      let s = perMailboxMap.get(mid);
      if (!s) { s = { count: 0, handled: 0, archived: 0, respSum: 0, respN: 0 }; perMailboxMap.set(mid, s); }
      s.count += 1;
      if (handledEnabled && e.handled_at) {
        s.handled += 1;
        if (e.created_at) {
          const d = (new Date(e.handled_at).getTime() - new Date(e.created_at).getTime()) / 60000;
          if (d > 0 && d < 60 * 24 * 30) { s.respSum += d; s.respN += 1; }
        }
      }
      if (e.status === "archived") {
        s.archived += 1;
        if (!handledEnabled) {
          const handledAt = e.claimed_at || e.assigned_at || e.inboria_processed_at;
          if (e.created_at && handledAt) {
            const d = (new Date(handledAt).getTime() - new Date(e.created_at).getTime()) / 60000;
            if (d > 0 && d < 60 * 24 * 30) { s.respSum += d; s.respN += 1; }
          }
        }
      }
    }
    const perMailbox = Array.from(perMailboxMap.entries()).map(([mid, s]) => {
      const meta = mbMap.get(mid);
      return {
        mailboxId: mid,
        mailboxName: meta?.name || meta?.email || "—",
        mailboxEmail: meta?.email || "",
        count: s.count,
        handled: s.handled,
        archived: s.archived,
        avgFirstResponseMinutes: s.respN > 0 ? Math.round(s.respSum / s.respN) : null,
      };
    }).sort((a, b) => b.count - a.count);

    const projIds = [...new Set(list.map((e: any) => e.project_id).filter(Boolean))] as string[];
    const projMap = new Map<string, { name: string; reference: string }>();
    if (projIds.length > 0) {
      const { data: prows } = await supabaseAdmin
        .from("projects")
        .select("id, name, reference")
        .in("id", projIds);
      for (const p of prows || []) projMap.set(p.id, { name: p.name || "", reference: p.reference || "" });
    }
    const perProjectMap = new Map<string, { count: number; handled: number; archived: number; respSum: number; respN: number }>();
    for (const e of list as any[]) {
      if (!e.project_id) continue;
      let s = perProjectMap.get(e.project_id);
      if (!s) { s = { count: 0, handled: 0, archived: 0, respSum: 0, respN: 0 }; perProjectMap.set(e.project_id, s); }
      s.count += 1;
      if (handledEnabled && e.handled_at) {
        s.handled += 1;
        if (e.created_at) {
          const d = (new Date(e.handled_at).getTime() - new Date(e.created_at).getTime()) / 60000;
          if (d > 0 && d < 60 * 24 * 30) { s.respSum += d; s.respN += 1; }
        }
      }
      if (e.status === "archived") {
        s.archived += 1;
        if (!handledEnabled) {
          const handledAt = e.claimed_at || e.assigned_at || e.inboria_processed_at;
          if (e.created_at && handledAt) {
            const d = (new Date(handledAt).getTime() - new Date(e.created_at).getTime()) / 60000;
            if (d > 0 && d < 60 * 24 * 30) { s.respSum += d; s.respN += 1; }
          }
        }
      }
    }
    const perProject = Array.from(perProjectMap.entries()).map(([pid, s]) => ({
      projectId: pid,
      projectName: projMap.get(pid)?.name || "",
      projectReference: projMap.get(pid)?.reference || "",
      count: s.count,
      handled: s.handled,
      archived: s.archived,
      avgFirstResponseMinutes: s.respN > 0 ? Math.round(s.respSum / s.respN) : null,
    })).sort((a, b) => b.count - a.count);

    res.json({
      totals: {
        emails: list.length,
        archived: list.filter((e: any) => e.status === "archived").length,
        assigned: list.filter((e: any) => !!e.assigned_to).length,
        // Toujours renvoyer un nombre — en legacy les valeurs sont calculées
        // via le proxy claimed_at/assigned_at/inboria_processed_at. Le flag
        // handledMetricsEnabled permet au frontend d'afficher le bandeau de
        // migration sans masquer les chiffres.
        handled: totalHandled,
        avgHandlingMinutes: handlingDelayCount > 0 ? Math.round(handlingDelaySumMin / handlingDelayCount) : null,
        period,
      },
      filters: { period, member: memberFilter, mailbox: mailboxFilter, project: projectFilter },
      handledMetricsEnabled: handledEnabled,
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
    const handledEnabled = await hasHandledColumns();

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

    const { data: csvOrgMailboxes } = await supabaseAdmin
      .from("shared_mailboxes")
      .select("id")
      .eq("organisation_id", orgId);
    const csvOrgMailboxIds = (csvOrgMailboxes || []).map((m: any) => m.id);
    const csvScopeParts: string[] = [`user_id.in.(${memberIds.join(",")})`];
    if (csvOrgMailboxIds.length > 0) {
      csvScopeParts.push(`shared_mailbox_id.in.(${csvOrgMailboxIds.join(",")})`);
    }
    const baseCsvCols = "id, subject, sender, status, assigned_to, claimed_by, created_at, claimed_at, assigned_at, inboria_processed_at";
    const csvCols = handledEnabled ? `${baseCsvCols}, handled_at, handled_by` : baseCsvCols;
    let csvQ = supabaseAdmin
      .from("emails")
      .select(csvCols)
      .or(csvScopeParts.join(","))
      .gte("created_at", sinceIso)
      .neq("status", "supprime");
    if (memberFilter) {
      if (handledEnabled) csvQ = csvQ.eq("handled_by", memberFilter);
      else csvQ = csvQ.or(`assigned_to.eq.${memberFilter},claimed_by.eq.${memberFilter}`);
    }
    if (mailboxFilter) csvQ = csvQ.eq("shared_mailbox_id", mailboxFilter);
    if (projectFilter) csvQ = csvQ.eq("project_id", projectFilter);
    const { data: list } = await csvQ.limit(20000);

    const lines: string[] = [
      ["email_id", "subject", "sender", "status", "handled_by", "handled_by_name", "created_at", "handled_at"].join(","),
    ];
    for (const e of (list || []) as any[]) {
      const handlerId = handledEnabled ? (e.handled_by || "") : (e.assigned_to || e.claimed_by || "");
      const handledAt = handledEnabled
        ? (e.handled_at || "")
        : (e.claimed_at || e.assigned_at || e.inboria_processed_at || "");
      lines.push([
        csvEscape(e.id),
        csvEscape(e.subject),
        csvEscape(e.sender),
        csvEscape(e.status),
        csvEscape(handlerId),
        csvEscape(profileMap.get(handlerId) || ""),
        csvEscape(e.created_at),
        csvEscape(handledAt),
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
    const handledEnabled = await hasHandledColumns();

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

    const { data: pdfOrgMailboxes } = await supabaseAdmin
      .from("shared_mailboxes")
      .select("id")
      .eq("organisation_id", orgId);
    const pdfOrgMailboxIds = (pdfOrgMailboxes || []).map((m: any) => m.id);
    const pdfScopeParts: string[] = [`user_id.in.(${memberIds.join(",")})`];
    if (pdfOrgMailboxIds.length > 0) {
      pdfScopeParts.push(`shared_mailbox_id.in.(${pdfOrgMailboxIds.join(",")})`);
    }
    const basePdfCols = "id, status, assigned_to, claimed_by, created_at";
    const pdfCols = handledEnabled ? `${basePdfCols}, handled_at, handled_by` : basePdfCols;
    let pdfQ = supabaseAdmin
      .from("emails")
      .select(pdfCols)
      .or(pdfScopeParts.join(","))
      .gte("created_at", sinceIso)
      .neq("status", "supprime");
    if (memberFilter) {
      if (handledEnabled) pdfQ = pdfQ.eq("handled_by", memberFilter);
      else pdfQ = pdfQ.or(`assigned_to.eq.${memberFilter},claimed_by.eq.${memberFilter}`);
    }
    if (mailboxFilter) pdfQ = pdfQ.eq("shared_mailbox_id", mailboxFilter);
    if (projectFilter) pdfQ = pdfQ.eq("project_id", projectFilter);
    const { data: list } = await pdfQ.limit(20000);

    const stats = new Map<string, { handled: number; archived: number; assigned: number }>();
    for (const uid of memberIds) stats.set(uid, { handled: 0, archived: 0, assigned: 0 });
    for (const e of (list || []) as any[]) {
      const handlerId = handledEnabled ? (e.handled_at ? e.handled_by : null) : (e.assigned_to || e.claimed_by || null);
      if (e.assigned_to && stats.has(e.assigned_to)) {
        stats.get(e.assigned_to)!.assigned += 1;
      }
      if (handlerId && stats.has(handlerId)) {
        stats.get(handlerId)!.handled += 1;
      }
      const archOwner = handlerId || e.assigned_to || e.claimed_by || null;
      if (e.status === "archived" && archOwner && stats.has(archOwner)) {
        stats.get(archOwner)!.archived += 1;
      }
    }

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
    doc.fontSize(11).fillColor("#475569").text(`Total emails reçus : ${(list || []).length}`);
    if (!handledEnabled) {
      doc.moveDown(0.2);
      doc.fontSize(9).fillColor("#b45309").text(
        "Migration handled_at non appliquée — les chiffres « Traités » utilisent l'ancien proxy (assigned/claimed).",
      );
    }
    doc.moveDown(1);

    // Délai moyen de réponse par membre (handled_at - created_at, sinon
    // proxy claimed_at/assigned_at/inboria_processed_at en mode legacy).
    const respStats = new Map<string, { sumMin: number; n: number }>();
    for (const uid of memberIds) respStats.set(uid, { sumMin: 0, n: 0 });
    for (const e of (list || []) as any[]) {
      const handledTs = handledEnabled
        ? (e.handled_at || null)
        : (e.claimed_at || e.assigned_at || e.inboria_processed_at || null);
      const ownerId = handledEnabled
        ? (e.handled_at ? e.handled_by : null)
        : (e.assigned_to || e.claimed_by || null);
      if (!ownerId || !handledTs || !e.created_at || !respStats.has(ownerId)) continue;
      const diffMin = Math.max(0, Math.floor((new Date(handledTs).getTime() - new Date(e.created_at).getTime()) / 60_000));
      if (diffMin >= 60 * 24 * 30) continue;
      const r = respStats.get(ownerId)!;
      r.sumMin += diffMin;
      r.n += 1;
    }

    const tableTop = doc.y;
    // Mode migré  : Membre / Traités / Écartés / Délai moyen.
    // Mode legacy : Membre / Assignés (proxy) / Écartés / Délai moyen.
    const colX = [48, 260, 360, 460];
    const headers = handledEnabled
      ? ["Membre", "Traités", "Écartés", "Délai moyen"]
      : ["Membre", "Assignés (proxy)", "Écartés", "Délai moyen"];
    doc.fontSize(11).fillColor("#0f172a");
    headers.forEach((h, i) => doc.text(h, colX[i], tableTop));
    doc
      .moveTo(48, tableTop + 16)
      .lineTo(560, tableTop + 16)
      .strokeColor("#cbd5e1")
      .stroke();

    const fmtDelay = (m: number | null): string => {
      if (m == null) return "—";
      if (m < 60) return `${m} min`;
      if (m < 60 * 24) return `${(m / 60).toFixed(1)} h`;
      return `${(m / (60 * 24)).toFixed(1)} j`;
    };

    let y = tableTop + 22;
    doc.fontSize(10).fillColor("#1e293b");
    for (const [uid, s] of stats.entries()) {
      const name = profileMap.get(uid) || uid.slice(0, 8);
      const r = respStats.get(uid);
      const avg = r && r.n > 0 ? Math.round(r.sumMin / r.n) : null;
      doc.text(name, colX[0], y, { width: 200, ellipsis: true });
      doc.text(handledEnabled ? String(s.handled) : String(s.assigned), colX[1], y);
      doc.text(String(s.archived), colX[2], y);
      doc.text(fmtDelay(avg), colX[3], y);
      y += 18;
      if (y > 770) {
        doc.addPage();
        y = 60;
      }
    }

    doc.moveDown(3);
    doc.fontSize(8).fillColor("#64748b").text(
      "Document généré par Inboria. « Traité » = action humaine explicite (réponse envoyée, transfert ou clic Marquer traité).",
      48,
      Math.min(y + 16, 800),
    );

    doc.end();
  } catch (e) {
    if (!res.headersSent) res.status(500).send("export error");
  }
});

export default router;
