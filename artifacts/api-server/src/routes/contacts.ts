import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";
import { summarizeContact } from "../services/contact-summarizer";

const router: IRouter = Router();

function isMissingTableErr(err: any): boolean {
  const msg = String(err?.message || err?.code || "");
  return msg.includes("does not exist") || msg.includes("schema cache") || msg.includes("PGRST205");
}

function normalizeEmail(s: string | null | undefined): string {
  return String(s || "").trim().toLowerCase();
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

type ManualContact = {
  id: string;
  email: string;
  displayName: string | null;
  phone: string | null;
  company: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

function mapManual(row: any): ManualContact {
  return {
    id: String(row.id),
    email: String(row.email),
    displayName: (row.display_name as string | null) || null,
    phone: (row.phone as string | null) || null,
    company: (row.company as string | null) || null,
    notes: (row.notes as string | null) || null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function parseSender(raw: string): { name: string; email: string } {
  if (!raw) return { name: "", email: "" };
  const m = raw.match(/^(.+?)\s*<(.+?)>$/);
  if (m) {
    return {
      name: m[1].trim().replace(/^"|"$/g, ""),
      email: m[2].trim().toLowerCase(),
    };
  }
  return { name: raw.trim(), email: raw.trim().toLowerCase() };
}

// Eclate un champ "recipient" qui peut être une liste séparée par virgule.
// Respecte les display names entre guillemets ("Doe, John" <john@x>) et les
// virgules à l'intérieur des chevrons.
function splitAddressList(raw: string): string[] {
  const out: string[] = [];
  let buf = "";
  let inQuote = false;
  let inAngle = false;
  for (const ch of raw) {
    if (ch === '"') inQuote = !inQuote;
    else if (ch === "<") inAngle = true;
    else if (ch === ">") inAngle = false;
    if (ch === "," && !inQuote && !inAngle) {
      if (buf.trim()) out.push(buf.trim());
      buf = "";
    } else {
      buf += ch;
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

function parseRecipients(raw: string | null | undefined): Array<{ name: string; email: string }> {
  if (!raw) return [];
  return splitAddressList(raw)
    .map(parseSender)
    .filter((x) => x.email.includes("@"));
}

// Adresse email du compte courant — à exclure de la liste de contacts.
async function getOwnAddresses(userId: string): Promise<Set<string>> {
  const own = new Set<string>();
  try {
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .maybeSingle();
    if (prof?.email) own.add(String(prof.email).toLowerCase());
  } catch {}
  try {
    const { data: conns } = await supabaseAdmin
      .from("email_connections")
      .select("email_address")
      .eq("user_id", userId);
    for (const c of conns || []) {
      if (c.email_address) own.add(String(c.email_address).toLowerCase());
    }
  } catch {}
  return own;
}

router.get("/contacts/search", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.userId!;
    const q = String(req.query["q"] || "").trim().toLowerCase();
    const limit = Math.min(parseInt(String(req.query["limit"] || "50"), 10) || 50, 200);
    const categoryIdsRaw = String(req.query["categoryIds"] || "").trim();
    const categoryIds = categoryIdsRaw
      ? categoryIdsRaw
          .split(",")
          .map((s) => parseInt(s, 10))
          .filter((n) => Number.isFinite(n))
      : [];

    let query = supabaseAdmin
      .from("emails")
      .select("id, sender, recipient, status, category_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(q ? 2000 : 5000);

    if (categoryIds.length > 0) {
      query = query.in("category_id", categoryIds);
    }

    // Pré-filtre côté DB quand on a une query : réduit massivement les bytes
    // transférés. Les faux positifs sont éliminés ensuite côté Node.
    if (q) {
      const escaped = q.replace(/[%_\\,()."']/g, (c) => `\\${c}`);
      const pat = `%${escaped}%`;
      query = query.or(`sender.ilike.${pat},recipient.ilike.${pat}`);
    }

    const { data: rows, error } = await query;
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const own = await getOwnAddresses(userId);

    type Agg = {
      email: string;
      displayName: string;
      lastInteractionAt: string;
      messageCount: number;
    };
    const map = new Map<string, Agg>();

    const consider = (parsed: { name: string; email: string }, createdAt: string) => {
      if (!parsed.email || !parsed.email.includes("@")) return;
      if (own.has(parsed.email)) return;
      if (q && !parsed.email.includes(q) && !parsed.name.toLowerCase().includes(q)) return;
      const existing = map.get(parsed.email);
      if (!existing) {
        map.set(parsed.email, {
          email: parsed.email,
          displayName: parsed.name || parsed.email,
          lastInteractionAt: createdAt,
          messageCount: 1,
        });
      } else {
        existing.messageCount += 1;
        if (createdAt > existing.lastInteractionAt) {
          existing.lastInteractionAt = createdAt;
        }
        if (!existing.displayName || existing.displayName === existing.email) {
          if (parsed.name && parsed.name !== parsed.email) {
            existing.displayName = parsed.name;
          }
        }
      }
    };

    for (const r of rows || []) {
      const created = String(r.created_at || "");
      // Inbox/received: from sender field.
      // Sent/scheduled/draft: from recipient field.
      const isOutgoing = r.status === "sent" || r.status === "scheduled" || r.status === "draft";
      if (isOutgoing) {
        for (const p of parseRecipients(r.recipient as string | null)) {
          consider(p, created);
        }
      } else {
        consider(parseSender(String(r.sender || "")), created);
        // Aussi inclure les destinataires en CC/TO pour ne rien rater.
        for (const p of parseRecipients(r.recipient as string | null)) {
          consider(p, created);
        }
      }
    }

    // Merger les contacts manuels — toujours inclus, marqués isManual.
    const manualSet = new Map<string, ManualContact>();
    try {
      let mq = supabaseAdmin
        .from("manual_contacts")
        .select("*")
        .eq("user_id", userId);
      if (q) {
        const escaped = q.replace(/[%_\\,()."']/g, (c) => `\\${c}`);
        const pat = `%${escaped}%`;
        mq = mq.or(
          `email.ilike.${pat},display_name.ilike.${pat},company.ilike.${pat}`,
        );
      }
      const { data: manualRows, error: manualErr } = await mq;
      if (manualErr && !isMissingTableErr(manualErr)) {
        req.log?.warn?.({ err: manualErr }, "[contacts] manual fetch failed");
      }
      for (const r of manualRows || []) {
        manualSet.set(normalizeEmail(r.email), mapManual(r));
      }
    } catch {}

    type Result = {
      email: string;
      displayName: string;
      lastInteractionAt: string;
      messageCount: number;
      isManual: boolean;
      manualId: string | null;
    };

    const results: Result[] = [];
    for (const c of map.values()) {
      const m = manualSet.get(c.email);
      results.push({
        email: c.email,
        displayName: m?.displayName || c.displayName,
        lastInteractionAt: c.lastInteractionAt,
        messageCount: c.messageCount,
        isManual: !!m,
        manualId: m?.id || null,
      });
    }
    // Manual-only (jamais reçu/envoyé d'email).
    for (const m of manualSet.values()) {
      const key = normalizeEmail(m.email);
      if (map.has(key)) continue;
      if (q && !key.includes(q) && !(m.displayName || "").toLowerCase().includes(q) && !(m.company || "").toLowerCase().includes(q)) continue;
      results.push({
        email: m.email,
        displayName: m.displayName || m.email,
        lastInteractionAt: m.updatedAt,
        messageCount: 0,
        isManual: true,
        manualId: m.id,
      });
    }

    const contacts = results
      .sort((a, b) => (a.lastInteractionAt < b.lastInteractionAt ? 1 : -1))
      .slice(0, limit);

    res.json({ contacts });
  } catch (err: any) {
    req.log?.error?.({ err }, "[contacts] search failed");
    res.status(500).json({ error: "Failed to search contacts" });
  }
});

router.get("/contacts/:email/timeline", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.userId!;
    const rawEmail = decodeURIComponent(String(req.params.email || "")).trim().toLowerCase();
    if (!rawEmail || !rawEmail.includes("@")) {
      res.status(400).json({ error: "invalid email" });
      return;
    }

    // Pré-filtre DB large via ILIKE %email% (rapide), puis matching exact côté
    // Node pour éviter les faux positifs (ex: ann@x ne doit PAS matcher joann@x).
    const escaped = rawEmail.replace(/[%_\\,()."']/g, (c) => `\\${c}`);
    const pattern = `%${escaped}%`;

    const { data: candidates, error: emailsErr } = await supabaseAdmin
      .from("emails")
      .select(
        "id, sender, recipient, subject, summary, status, category_id, created_at, project_id, categories(name), projects(name, reference)",
      )
      .eq("user_id", userId)
      .or(`sender.ilike.${pattern},recipient.ilike.${pattern}`)
      .order("created_at", { ascending: false })
      .limit(2000);

    if (emailsErr) {
      res.status(500).json({ error: emailsErr.message });
      return;
    }

    const emails = (candidates || []).filter((e: any) => {
      const senderEmail = parseSender(String(e.sender || "")).email;
      if (senderEmail === rawEmail) return true;
      for (const r of parseRecipients(e.recipient)) {
        if (r.email === rawEmail) return true;
      }
      return false;
    });

    const emailIds = (emails || []).map((e: any) => e.id);

    type Item = {
      type: string;
      id: string;
      occurredAt: string;
      title: string;
      snippet?: string | null;
      categoryName?: string | null;
      href?: string | null;
    };
    const items: Item[] = [];

    for (const e of emails || []) {
      let typeKey = "received";
      if (e.status === "sent") typeKey = "sent";
      else if (e.status === "scheduled" || e.status === "draft") typeKey = "scheduled";
      else if (e.status === "snoozed") typeKey = "snoozed";
      else if (e.status === "archived") typeKey = "archive";
      items.push({
        type: typeKey,
        id: `email-${e.id}`,
        occurredAt: String(e.created_at),
        title: e.subject || "(sans objet)",
        snippet: (e.summary as string | null) || null,
        categoryName: (e as any).categories?.name || null,
        href: `/dashboard?emailId=${e.id}`,
      });
    }

    // Projets liés (déduits depuis les emails) — calculés tôt pour élargir
    // les requêtes tâches / relances / RDV au-delà du seul email_id.
    const projectIdsForLinks = Array.from(
      new Set(
        (emails || [])
          .map((e: any) => e.project_id)
          .filter((id: any) => id != null),
      ),
    );

    const seenTaskIds = new Set<string>();
    const seenFollowupIds = new Set<string>();
    const seenApptIds = new Set<string>();

    const pushTasks = (rows: any[] | null | undefined) => {
      for (const t of rows || []) {
        const id = String(t.id);
        if (seenTaskIds.has(id)) continue;
        seenTaskIds.add(id);
        items.push({
          type: "task",
          id: `task-${id}`,
          occurredAt: String(t.due_date || t.created_at),
          title: t.title || "(tâche)",
          snippet: null,
          categoryName: null,
        });
      }
    };
    const pushFollowups = (rows: any[] | null | undefined) => {
      for (const f of rows || []) {
        const id = String(f.id);
        if (seenFollowupIds.has(id)) continue;
        seenFollowupIds.add(id);
        const t = f.title || (f.ai_suggestion ? String(f.ai_suggestion).slice(0, 120) : "(relance)");
        items.push({
          type: "followup",
          id: `followup-${id}`,
          occurredAt: String(f.due_date || f.created_at),
          title: t,
          snippet: (f.notes as string | null) || null,
          categoryName: null,
        });
      }
    };
    const pushAppts = (rows: any[] | null | undefined) => {
      for (const a of rows || []) {
        const id = String(a.id);
        if (seenApptIds.has(id)) continue;
        seenApptIds.add(id);
        items.push({
          type: "appointment",
          id: `appt-${id}`,
          occurredAt: String(a.start_at || a.created_at),
          title: a.title || "(rendez-vous)",
          snippet: (a.description as string | null) || null,
          categoryName: null,
        });
      }
    };

    // Tâches / relances / RDV liés via email_id
    if (emailIds.length > 0) {
      const [r1, r2, r3] = await Promise.all([
        supabaseAdmin
          .from("tasks")
          .select("id, title, done, due_date, created_at, email_id, project_id")
          .eq("user_id", userId)
          .in("email_id", emailIds),
        supabaseAdmin
          .from("followups")
          .select("id, title, status, ai_suggestion, notes, due_date, email_id, created_at")
          .eq("user_id", userId)
          .in("email_id", emailIds),
        supabaseAdmin
          .from("appointments")
          .select("id, title, description, start_at, end_at, email_id, created_at")
          .eq("user_id", userId)
          .in("email_id", emailIds),
      ]);
      if (r1.error) req.log?.warn?.({ err: r1.error }, "[contacts/timeline] tasks email_id query failed");
      if (r2.error) req.log?.warn?.({ err: r2.error }, "[contacts/timeline] followups email_id query failed");
      if (r3.error) req.log?.warn?.({ err: r3.error }, "[contacts/timeline] appointments email_id query failed");
      pushTasks(r1.data);
      pushFollowups(r2.data);
      pushAppts(r3.data);
    }

    // Élargissement via project_id (tâches/RDV/relances créés directement
    // sur un projet partagé avec ce contact). Doublons gérés via seen* sets.
    if (projectIdsForLinks.length > 0) {
      const [r1, r2, r3] = await Promise.all([
        supabaseAdmin
          .from("tasks")
          .select("id, title, done, due_date, created_at, email_id, project_id")
          .eq("user_id", userId)
          .in("project_id", projectIdsForLinks),
        supabaseAdmin
          .from("appointments")
          .select("id, title, description, start_at, end_at, email_id, created_at, project_id")
          .eq("user_id", userId)
          .in("project_id", projectIdsForLinks),
        supabaseAdmin
          .from("followups")
          .select("id, title, status, ai_suggestion, notes, due_date, email_id, created_at, project_id")
          .eq("user_id", userId)
          .in("project_id", projectIdsForLinks),
      ]);
      if (r1.error) req.log?.warn?.({ err: r1.error }, "[contacts/timeline] tasks project_id query failed");
      if (r2.error) req.log?.warn?.({ err: r2.error }, "[contacts/timeline] appointments project_id query failed");
      if (r3.error) req.log?.warn?.({ err: r3.error }, "[contacts/timeline] followups project_id query failed");
      pushTasks(r1.data);
      pushAppts(r2.data);
      pushFollowups(r3.data);
    }

    // Activité équipe — table activity_logs absente du schéma chez certains
    // tenants. On utilise email_comments (commentaires sur les emails du
    // contact) comme source principale, et on essaye activity_logs en best-
    // effort pour les tenants où elle existe.
    if (emailIds.length > 0) {
      const [comments, activityRes] = await Promise.all([
        supabaseAdmin
          .from("email_comments")
          .select("id, user_id, email_id, body, created_at")
          .in("email_id", emailIds)
          .order("created_at", { ascending: false })
          .limit(200),
        supabaseAdmin
          .from("activity_logs")
          .select("id, user_id, action, entity_type, entity_id, details, created_at")
          .eq("entity_type", "email")
          .in("entity_id", emailIds.map((x: any) => String(x)))
          .order("created_at", { ascending: false })
          .limit(200),
      ]);

      const actorIds = Array.from(
        new Set([
          ...(comments.data || []).map((c: any) => c.user_id).filter(Boolean),
          ...(activityRes.data || []).map((a: any) => a.user_id).filter(Boolean),
        ]),
      );
      const actorNames = new Map<string, string>();
      if (actorIds.length > 0) {
        const { data: profs } = await supabaseAdmin
          .from("profiles")
          .select("id, full_name")
          .in("id", actorIds);
        for (const p of profs || []) actorNames.set(String((p as any).id), String((p as any).full_name || ""));
      }

      for (const c of comments.data || []) {
        const who = actorNames.get(String(c.user_id)) || "Membre";
        items.push({
          type: "team",
          id: `comment-${c.id}`,
          occurredAt: String(c.created_at),
          title: `${who} — commentaire`,
          snippet: (c.body as string | null) || null,
          categoryName: null,
        });
      }

      for (const a of activityRes.data || []) {
        const who = actorNames.get(String((a as any).user_id)) || "Membre";
        const action = String((a as any).action || "");
        const detailsObj = ((a as any).details as Record<string, any> | null) || {};
        const detailStr = Object.entries(detailsObj)
          .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
          .join(" · ");
        items.push({
          type: "team",
          id: `activity-${(a as any).id}`,
          occurredAt: String((a as any).created_at),
          title: `${who} — ${action}`,
          snippet: detailStr || null,
          categoryName: null,
        });
      }
    }

    // Projets liés (via les emails de ce contact)
    if (projectIdsForLinks.length > 0) {
      const { data: projects } = await supabaseAdmin
        .from("projects")
        .select("id, name, reference, created_at, description")
        .eq("user_id", userId)
        .in("id", projectIdsForLinks);
      for (const p of projects || []) {
        items.push({
          type: "project",
          id: `project-${p.id}`,
          occurredAt: String((p as any).created_at),
          title: (p as any).reference
            ? `${(p as any).reference} — ${(p as any).name}`
            : String((p as any).name || "(projet)"),
          snippet: ((p as any).description as string | null) || null,
          categoryName: null,
          href: `/dashboard/projets`,
        });
      }
    }

    // Tri DESC strict par date (identique au dashboard /api/emails),
    // avec parsing robuste (chaînes ISO non parseables → epoch 0).
    items.sort((a, b) => {
      const ta = Date.parse(a.occurredAt) || 0;
      const tb = Date.parse(b.occurredAt) || 0;
      return tb - ta;
    });

    // Fiche manuelle si elle existe.
    let manual: ManualContact | null = null;
    try {
      const { data: m, error: mErr } = await supabaseAdmin
        .from("manual_contacts")
        .select("*")
        .eq("user_id", userId)
        .eq("email", rawEmail)
        .maybeSingle();
      if (!mErr && m) manual = mapManual(m);
      if (mErr && !isMissingTableErr(mErr)) {
        req.log?.warn?.({ err: mErr }, "[contacts] timeline manual fetch failed");
      }
    } catch {}

    // Email Brain Phase 2 (#215) — synthèse Inboria de la relation.
    // Best-effort + timeout 800ms : on n'attend jamais l'IA pour
    // afficher la timeline.
    let summary: { content: string; generatedAt: string } | null = null;
    try {
      summary = await Promise.race([
        summarizeContact(userId, rawEmail),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 800)),
      ]);
    } catch (err: any) {
      req.log?.warn?.({ err: err?.message }, "[contacts] summary failed");
    }

    res.json({ email: rawEmail, manual, items, summary });
  } catch (err: any) {
    req.log?.error?.({ err }, "[contacts] timeline failed");
    res.status(500).json({ error: "Failed to load timeline" });
  }
});

// ----- Manual contacts CRUD ------------------------------------------------

router.get("/contacts/manual", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.userId!;
    const { data, error } = await supabaseAdmin
      .from("manual_contacts")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) {
      if (isMissingTableErr(error)) {
        res.json([]);
        return;
      }
      res.status(500).json({ error: error.message });
      return;
    }
    res.json((data || []).map(mapManual));
  } catch (err: any) {
    req.log?.error?.({ err }, "[contacts] list manual failed");
    res.status(500).json({ error: "Failed to list manual contacts" });
  }
});

router.post("/contacts/manual", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.userId!;
    const body = req.body || {};
    const email = normalizeEmail(body.email);
    if (!email || !isValidEmail(email)) {
      res.status(400).json({ error: "Adresse e-mail invalide" });
      return;
    }
    const payload = {
      user_id: userId,
      email,
      display_name: body.displayName ? String(body.displayName).trim() : null,
      phone: body.phone ? String(body.phone).trim() : null,
      company: body.company ? String(body.company).trim() : null,
      notes: body.notes ? String(body.notes).trim() : null,
    };
    const { data, error } = await supabaseAdmin
      .from("manual_contacts")
      .insert(payload)
      .select("*")
      .single();
    if (error) {
      if (isMissingTableErr(error)) {
        res.status(503).json({
          error: "Table manual_contacts absente — appliquez migrations/2026_05_03_manual_contacts.sql",
        });
        return;
      }
      if (String(error.message).toLowerCase().includes("duplicate")) {
        res.status(409).json({ error: "Ce contact existe déjà" });
        return;
      }
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(201).json(mapManual(data));
  } catch (err: any) {
    req.log?.error?.({ err }, "[contacts] create manual failed");
    res.status(500).json({ error: "Failed to create contact" });
  }
});

router.patch("/contacts/manual/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.userId!;
    const id = String(req.params.id || "");
    const body = req.body || {};
    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (body.email !== undefined) {
      const e = normalizeEmail(body.email);
      if (!isValidEmail(e)) {
        res.status(400).json({ error: "Adresse e-mail invalide" });
        return;
      }
      updates.email = e;
    }
    if (body.displayName !== undefined) updates.display_name = body.displayName ? String(body.displayName).trim() : null;
    if (body.phone !== undefined) updates.phone = body.phone ? String(body.phone).trim() : null;
    if (body.company !== undefined) updates.company = body.company ? String(body.company).trim() : null;
    if (body.notes !== undefined) updates.notes = body.notes ? String(body.notes).trim() : null;

    const { data, error } = await supabaseAdmin
      .from("manual_contacts")
      .update(updates)
      .eq("id", id)
      .eq("user_id", userId)
      .select("*")
      .single();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(mapManual(data));
  } catch (err: any) {
    req.log?.error?.({ err }, "[contacts] update manual failed");
    res.status(500).json({ error: "Failed to update contact" });
  }
});

router.delete("/contacts/manual/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.userId!;
    const id = String(req.params.id || "");
    const { error } = await supabaseAdmin
      .from("manual_contacts")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ ok: true });
  } catch (err: any) {
    req.log?.error?.({ err }, "[contacts] delete manual failed");
    res.status(500).json({ error: "Failed to delete contact" });
  }
});

export default router;
