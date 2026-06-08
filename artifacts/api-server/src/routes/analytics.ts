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

// Supabase/PostgREST plafonne à 1000 lignes par requête (db-max-rows).
// Ce helper récupère TOUTES les lignes via .range() pour éviter des KPI faux.
async function fetchAllRows<T = any>(buildQuery: () => any, hardCap = 50000): Promise<T[]> {
  const PAGE_SIZE = 1000;
  const out: T[] = [];
  let from = 0;
  while (from < hardCap) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await buildQuery().range(from, to);
    if (error) break;
    const rows = (data || []) as T[];
    out.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return out;
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
    const memberIdsList = memberIds.join(",");
    const scopeParts: string[] = [`user_id.in.(${memberIdsList})`];
    if (orgMailboxIds.length > 0) {
      scopeParts.push(`shared_mailbox_id.in.(${orgMailboxIds.join(",")})`);
    }

    function buildEmailsQuery() {
      let q = supabaseAdmin
        .from("emails")
        .select(cols)
        .gte("created_at", sinceIso)
        .neq("status", "supprime")
        .or(scopeParts.join(","));
      if (memberFilter) {
        if (handledEnabled) q = q.eq("handled_by", memberFilter);
        else q = q.or(`assigned_to.eq.${memberFilter},claimed_by.eq.${memberFilter}`);
      }
      if (mailboxFilter) q = q.eq("shared_mailbox_id", mailboxFilter);
      if (projectFilter) q = q.eq("project_id", projectFilter);
      return q;
    }

    const list = await fetchAllRows<any>(buildEmailsQuery);

    const profileMap = new Map<string, string>();
    if (memberIds.length > 0) {
      // Une seule requête groupée au lieu d'un SELECT par membre (anti N+1) :
      // sur une organisation à dizaines de membres ça remplace des dizaines
      // d'aller-retours Supabase par un unique `.in()`.
      const { data: profileRows } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name")
        .in("id", memberIds);
      for (const p of profileRows || []) {
        profileMap.set(p.id as string, (p.full_name as string) || "");
      }
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

    // ===== Charge ouverte par membre (snapshot non lié à la période) =====
    // = emails assignés au membre ET non clôturés (pas archivé/supprimé/handled).
    const openLoadMap = new Map<string, number>();
    for (const uid of memberIds) openLoadMap.set(uid, 0);
    {
      const openRows = await fetchAllRows<any>(() => {
        let openQ = supabaseAdmin
          .from("emails")
          .select("id, assigned_to, status, handled_at")
          .in("assigned_to", memberIds)
          .not("status", "in", "(archived,supprime,trashed,done)");
        if (handledEnabled) openQ = openQ.is("handled_at", null);
        return openQ;
      });
      for (const r of openRows as any[]) {
        if (r.assigned_to && openLoadMap.has(r.assigned_to)) {
          openLoadMap.set(r.assigned_to, (openLoadMap.get(r.assigned_to) || 0) + 1);
        }
      }
    }

    const perMember = Array.from(perMemberMap.entries())
      .filter(([uid]) => !memberFilter || uid === memberFilter)
      .map(([uid, s]) => ({
        userId: uid,
        userName: profileMap.get(uid) || "",
        handled: s.handled,
        assigned: s.assigned,
        openLoad: openLoadMap.get(uid) || 0,
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
        received: s.count,
        handled: s.handled,
        notHandled: Math.max(0, s.count - s.handled),
        avgFirstResponseMinutes: s.respN > 0 ? Math.round(s.respSum / s.respN) : null,
      };
    }).sort((a, b) => b.received - a.received);

    // ===== Par boîte personnelle (emails sans shared_mailbox_id, par membre) =====
    const perPersonalMap = new Map<string, { count: number; handled: number; respSum: number; respN: number }>();
    for (const e of list as any[]) {
      if (e.shared_mailbox_id) continue;
      const uid = e.user_id;
      if (!uid || !memberIds.includes(uid)) continue;
      let s = perPersonalMap.get(uid);
      if (!s) { s = { count: 0, handled: 0, respSum: 0, respN: 0 }; perPersonalMap.set(uid, s); }
      s.count += 1;
      const handledTs = handledEnabled ? e.handled_at : (e.claimed_at || e.assigned_at || e.inboria_processed_at);
      if (handledTs) {
        s.handled += 1;
        if (e.created_at) {
          const d = (new Date(handledTs).getTime() - new Date(e.created_at).getTime()) / 60000;
          if (d > 0 && d < 60 * 24 * 30) { s.respSum += d; s.respN += 1; }
        }
      }
    }
    const perPersonalMailbox = Array.from(perPersonalMap.entries()).map(([uid, s]) => ({
      userId: uid,
      userName: profileMap.get(uid) || "",
      received: s.count,
      handled: s.handled,
      notHandled: Math.max(0, s.count - s.handled),
      avgFirstResponseMinutes: s.respN > 0 ? Math.round(s.respSum / s.respN) : null,
    })).sort((a, b) => b.received - a.received);

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
      received: s.count,
      handled: s.handled,
      notHandled: Math.max(0, s.count - s.handled),
      avgFirstResponseMinutes: s.respN > 0 ? Math.round(s.respSum / s.respN) : null,
    })).sort((a, b) => b.received - a.received);

    // ===== Bloc Tâches =====
    const todayIso = new Date().toISOString().slice(0, 10);
    let tasksList: any[] = [];
    {
      // Deux requêtes pour éviter le bug PostgREST .or()+in.() avec UUIDs.
      const [byUserRows, byAssigneeRows] = await Promise.all([
        fetchAllRows<any>(() => supabaseAdmin
          .from("tasks")
          .select("id, user_id, assigned_to_user_id, project_id, done, due_date, created_at")
          .in("user_id", memberIds)),
        fetchAllRows<any>(() => supabaseAdmin
          .from("tasks")
          .select("id, user_id, assigned_to_user_id, project_id, done, due_date, created_at")
          .in("assigned_to_user_id", memberIds)),
      ]);
      const seen = new Set<string>();
      for (const t of [...byUserRows, ...byAssigneeRows] as any[]) {
        if (!t?.id || seen.has(t.id)) continue;
        seen.add(t.id);
        tasksList.push(t);
      }
    }
    const tasksPerMemberMap = new Map<string, { open: number; done: number; overdue: number }>();
    for (const uid of memberIds) tasksPerMemberMap.set(uid, { open: 0, done: 0, overdue: 0 });
    for (const t of tasksList) {
      const ownerId = t.assigned_to_user_id || t.user_id;
      if (!ownerId || !tasksPerMemberMap.has(ownerId)) continue;
      const stats = tasksPerMemberMap.get(ownerId)!;
      // Pas de colonne updated_at sur tasks → "Terminées" = état actuel
      // (toutes les tâches done=true du membre), pas filtré par période.
      if (t.done) {
        stats.done += 1;
      } else {
        stats.open += 1;
        if (t.due_date && t.due_date < todayIso) stats.overdue += 1;
      }
    }
    const tasksPerMember = Array.from(tasksPerMemberMap.entries())
      .filter(([uid, s]) => s.open + s.done + s.overdue > 0 || !memberFilter || uid === memberFilter)
      .map(([uid, s]) => ({
        userId: uid,
        userName: profileMap.get(uid) || "",
        open: s.open,
        done: s.done,
        overdue: s.overdue,
      }))
      .sort((a, b) => (b.open + b.done) - (a.open + a.done));

    // Per project (incl. ligne hors projet)
    const tasksProjIds = [...new Set(tasksList.map((t) => t.project_id).filter(Boolean))] as string[];
    const missingProjIds = tasksProjIds.filter((pid) => !projMap.has(pid));
    if (missingProjIds.length > 0) {
      const { data: extraProjects } = await supabaseAdmin
        .from("projects")
        .select("id, name, reference")
        .in("id", missingProjIds);
      for (const p of extraProjects || []) projMap.set(p.id, { name: p.name || "", reference: p.reference || "" });
    }
    const tasksPerProjectMap = new Map<string | null, { open: number; done: number; overdue: number }>();
    for (const t of tasksList) {
      const key = t.project_id || null;
      let s = tasksPerProjectMap.get(key);
      if (!s) { s = { open: 0, done: 0, overdue: 0 }; tasksPerProjectMap.set(key, s); }
      if (t.done) {
        if (t.updated_at && new Date(t.updated_at).toISOString() >= sinceIso) s.done += 1;
      } else {
        s.open += 1;
        if (t.due_date && t.due_date < todayIso) s.overdue += 1;
      }
    }
    const tasksPerProject = Array.from(tasksPerProjectMap.entries())
      .map(([pid, s]) => ({
        projectId: pid,
        projectName: pid ? (projMap.get(pid)?.name || "—") : "Hors projet",
        projectReference: pid ? (projMap.get(pid)?.reference || "") : "",
        isOutOfProject: pid === null,
        open: s.open,
        done: s.done,
        overdue: s.overdue,
      }))
      .sort((a, b) => {
        if (a.isOutOfProject) return 1;
        if (b.isOutOfProject) return -1;
        return (b.open + b.done) - (a.open + a.done);
      });

    const totalHandledNum = totalHandled ?? 0;
    res.json({
      totals: {
        emails: list.length,
        assigned: list.filter((e: any) => !!e.assigned_to).length,
        notHandled: Math.max(0, list.length - totalHandledNum),
        // Toujours renvoyer un nombre — en legacy les valeurs sont calculées
        // via le proxy claimed_at/assigned_at/inboria_processed_at. Le flag
        // handledMetricsEnabled permet au frontend d'afficher le bandeau de
        // migration sans masquer les chiffres.
        handled: totalHandled,
        // Garde statistique : on n'expose une moyenne que si l'échantillon
        // est >= 5 traités, sinon "—" côté client. Évite les "26 min sur 2"
        // trompeurs.
        avgHandlingMinutes: handlingDelayCount >= 5 ? Math.round(handlingDelaySumMin / handlingDelayCount) : null,
        avgHandlingSampleSize: handlingDelayCount,
        period,
      },
      filters: { period, member: memberFilter, mailbox: mailboxFilter, project: projectFilter },
      handledMetricsEnabled: handledEnabled,
      perMember,
      perMailbox,
      perPersonalMailbox,
      perProject,
      tasksPerMember,
      tasksPerProject,
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
    if (memberIds.length > 0) {
      // Une seule requête groupée au lieu d'un SELECT par membre (anti N+1) :
      // sur une organisation à dizaines de membres ça remplace des dizaines
      // d'aller-retours Supabase par un unique `.in()`.
      const { data: profileRows } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name")
        .in("id", memberIds);
      for (const p of profileRows || []) {
        profileMap.set(p.id as string, (p.full_name as string) || "");
      }
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
    const list = await fetchAllRows<any>(() => {
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
      return csvQ;
    });

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
    if (memberIds.length > 0) {
      // Une seule requête groupée au lieu d'un SELECT par membre (anti N+1) :
      // sur une organisation à dizaines de membres ça remplace des dizaines
      // d'aller-retours Supabase par un unique `.in()`.
      const { data: profileRows } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name")
        .in("id", memberIds);
      for (const p of profileRows || []) {
        profileMap.set(p.id as string, (p.full_name as string) || "");
      }
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
    // claimed_at/assigned_at/inboria_processed_at servent de proxy de délai
    // en mode legacy (avant la migration handled_at). Toujours sélectionnés
    // pour ne pas dégrader silencieusement le calcul du délai moyen.
    const basePdfCols = "id, status, assigned_to, claimed_by, created_at, claimed_at, assigned_at, inboria_processed_at, shared_mailbox_id, project_id";
    const pdfCols = handledEnabled ? `${basePdfCols}, handled_at, handled_by` : basePdfCols;
    const list = await fetchAllRows<any>(() => {
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
      return pdfQ;
    });

    // ===== Agrégats Mails (par membre / charge ouverte / délai moyen) =====
    const stats = new Map<string, { handled: number; assigned: number }>();
    const respStats = new Map<string, { sumMin: number; n: number }>();
    for (const uid of memberIds) {
      stats.set(uid, { handled: 0, assigned: 0 });
      respStats.set(uid, { sumMin: 0, n: 0 });
    }
    let totalHandled = 0;
    for (const e of (list || []) as any[]) {
      const handlerId = handledEnabled ? (e.handled_at ? e.handled_by : null) : (e.assigned_to || e.claimed_by || null);
      const handledTs = handledEnabled
        ? (e.handled_at || null)
        : (e.claimed_at || e.assigned_at || e.inboria_processed_at || null);
      if (e.assigned_to && stats.has(e.assigned_to)) {
        stats.get(e.assigned_to)!.assigned += 1;
      }
      if (handlerId && stats.has(handlerId)) {
        stats.get(handlerId)!.handled += 1;
        totalHandled += 1;
      }
      if (handlerId && handledTs && e.created_at && respStats.has(handlerId)) {
        const diffMin = Math.max(0, Math.floor((new Date(handledTs).getTime() - new Date(e.created_at).getTime()) / 60_000));
        if (diffMin < 60 * 24 * 30) {
          const r = respStats.get(handlerId)!;
          r.sumMin += diffMin;
          r.n += 1;
        }
      }
    }

    // Charge ouverte par membre = emails assignés non clôturés
    const openLoadMap = new Map<string, number>();
    for (const uid of memberIds) openLoadMap.set(uid, 0);
    if (memberIds.length > 0) {
      const openRows = await fetchAllRows<any>(() => {
        let openQ = supabaseAdmin
          .from("emails")
          .select("id, assigned_to, handled_at")
          .in("assigned_to", memberIds)
          .not("status", "in", "(archived,supprime,trashed,done)");
        if (handledEnabled) openQ = openQ.is("handled_at", null);
        return openQ;
      });
      for (const r of openRows as any[]) {
        if (r.assigned_to && openLoadMap.has(r.assigned_to)) {
          openLoadMap.set(r.assigned_to, (openLoadMap.get(r.assigned_to) || 0) + 1);
        }
      }
    }

    // ===== Agrégats Tâches (par membre) =====
    const todayIsoPdf = new Date().toISOString().slice(0, 10);
    const taskStats = new Map<string, { open: number; done: number; overdue: number }>();
    for (const uid of memberIds) taskStats.set(uid, { open: 0, done: 0, overdue: 0 });
    if (memberIds.length > 0) {
      const [byUserRows, byAssigneeRows] = await Promise.all([
        fetchAllRows<any>(() => supabaseAdmin.from("tasks").select("id, user_id, assigned_to_user_id, done, due_date").in("user_id", memberIds)),
        fetchAllRows<any>(() => supabaseAdmin.from("tasks").select("id, user_id, assigned_to_user_id, done, due_date").in("assigned_to_user_id", memberIds)),
      ]);
      const seen = new Set<string>();
      for (const t of [...byUserRows, ...byAssigneeRows] as any[]) {
        if (!t?.id || seen.has(t.id)) continue;
        seen.add(t.id);
        const ownerId = t.assigned_to_user_id || t.user_id;
        if (!ownerId || !taskStats.has(ownerId)) continue;
        const s = taskStats.get(ownerId)!;
        if (t.done) {
          s.done += 1;
        } else {
          s.open += 1;
          if (t.due_date && t.due_date < todayIsoPdf) s.overdue += 1;
        }
      }
    }

    // ===== Génération PDF =====
    const doc = new PDFDocument({ size: "A4", margin: 48, info: { Title: `Inboria — Bilan équipe ${period}` } });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="inboria-team-${period}.pdf"`);
    doc.pipe(res);

    const fmtDelay = (m: number | null): string => {
      if (m == null) return "—";
      if (m < 60) return `${m} min`;
      if (m < 60 * 24) return `${(m / 60).toFixed(1)} h`;
      return `${(m / (60 * 24)).toFixed(1)} j`;
    };

    doc.fontSize(20).fillColor("#0f172a").text("Inboria — Bilan équipe", { align: "left" });
    doc.moveDown(0.2);
    doc.fontSize(11).fillColor("#475569").text(`Période : ${period} · Généré le ${new Date().toLocaleString()}`);

    // KPIs
    const totalEmails = (list || []).length;
    const totalNotHandled = Math.max(0, totalEmails - totalHandled);
    let totalRespSum = 0, totalRespN = 0;
    for (const r of respStats.values()) { totalRespSum += r.sumMin; totalRespN += r.n; }
    // Même garde statistique que l'API JSON : N >= 5 sinon "—".
    const avgDelay = totalRespN >= 5 ? Math.round(totalRespSum / totalRespN) : null;
    doc.moveDown(0.6);
    doc.fontSize(11).fillColor("#0f172a").text(
      `Reçus : ${totalEmails}    ·    Traités : ${totalHandled}    ·    Non traités : ${totalNotHandled}    ·    Délai moyen : ${fmtDelay(avgDelay)}`,
    );
    if (!handledEnabled) {
      doc.moveDown(0.2);
      doc.fontSize(9).fillColor("#b45309").text(
        "Migration handled_at non appliquée — les chiffres « Traités » utilisent l'ancien proxy (assigned/claimed).",
      );
    }
    doc.moveDown(1);

    // ===== Table Mails par membre =====
    doc.fontSize(13).fillColor("#0f172a").text("Mails — par membre");
    doc.moveDown(0.3);
    {
      const tableTop = doc.y;
      const colX = [48, 260, 360, 460];
      const headers = ["Membre", "Charge ouverte", "Traités", "Délai moyen"];
      doc.fontSize(11).fillColor("#0f172a");
      headers.forEach((h, i) => doc.text(h, colX[i], tableTop));
      doc.moveTo(48, tableTop + 16).lineTo(560, tableTop + 16).strokeColor("#cbd5e1").stroke();
      let y = tableTop + 22;
      doc.fontSize(10).fillColor("#1e293b");
      for (const [uid, s] of stats.entries()) {
        const name = profileMap.get(uid) || uid.slice(0, 8);
        const r = respStats.get(uid);
        const avg = r && r.n > 0 ? Math.round(r.sumMin / r.n) : null;
        doc.text(name, colX[0], y, { width: 200, ellipsis: true });
        doc.text(String(openLoadMap.get(uid) || 0), colX[1], y);
        doc.text(handledEnabled ? String(s.handled) : String(s.assigned), colX[2], y);
        doc.text(fmtDelay(avg), colX[3], y);
        y += 18;
        if (y > 770) { doc.addPage(); y = 60; }
      }
      doc.y = y + 10;
    }

    // ===== Table Tâches par membre =====
    if (doc.y > 700) doc.addPage();
    doc.fontSize(13).fillColor("#0f172a").text("Tâches — par membre");
    doc.moveDown(0.3);
    {
      const tableTop = doc.y;
      const colX = [48, 260, 360, 460];
      const headers = ["Membre", "Ouvertes", "Terminées", "En retard"];
      doc.fontSize(11).fillColor("#0f172a");
      headers.forEach((h, i) => doc.text(h, colX[i], tableTop));
      doc.moveTo(48, tableTop + 16).lineTo(560, tableTop + 16).strokeColor("#cbd5e1").stroke();
      let y = tableTop + 22;
      doc.fontSize(10).fillColor("#1e293b");
      for (const [uid, s] of taskStats.entries()) {
        const name = profileMap.get(uid) || uid.slice(0, 8);
        doc.text(name, colX[0], y, { width: 200, ellipsis: true });
        doc.text(String(s.open), colX[1], y);
        doc.text(String(s.done), colX[2], y);
        doc.text(String(s.overdue), colX[3], y);
        y += 18;
        if (y > 770) { doc.addPage(); y = 60; }
      }
      doc.y = y + 10;
    }

    doc.fontSize(8).fillColor("#64748b").text(
      "Document généré par Inboria. « Traité » = action humaine explicite (réponse envoyée, transfert ou clic Marquer traité). « Charge ouverte » = emails assignés et non clôturés. « En retard » = tâches ouvertes dont l'échéance est dépassée.",
      48,
      Math.min(doc.y + 6, 800),
      { width: 500 },
    );

    doc.end();
  } catch (e) {
    if (!res.headersSent) res.status(500).send("export error");
  }
});

export default router;
