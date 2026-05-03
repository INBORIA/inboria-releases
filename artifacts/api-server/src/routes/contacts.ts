import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

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

    const contacts = Array.from(map.values())
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

    // Tâches liées
    if (emailIds.length > 0) {
      const { data: tasks } = await supabaseAdmin
        .from("tasks")
        .select("id, title, description, done, created_at, email_id, project_id, projects(name, reference)")
        .eq("user_id", userId)
        .in("email_id", emailIds);
      for (const t of tasks || []) {
        items.push({
          type: "task",
          id: `task-${t.id}`,
          occurredAt: String(t.created_at),
          title: (t as any).title || "(tâche)",
          snippet: ((t as any).description as string | null) || null,
          categoryName: null,
        });
      }

      // Relances liées
      const { data: followups } = await supabaseAdmin
        .from("followups")
        .select("id, scheduled_at, status, ai_suggestion, email_id, created_at")
        .eq("user_id", userId)
        .in("email_id", emailIds);
      for (const f of followups || []) {
        items.push({
          type: "followup",
          id: `followup-${f.id}`,
          occurredAt: String((f as any).scheduled_at || (f as any).created_at),
          title: (f as any).ai_suggestion ? String((f as any).ai_suggestion).slice(0, 120) : "(relance)",
          snippet: null,
          categoryName: null,
        });
      }

      // RDV liés
      const { data: appts } = await supabaseAdmin
        .from("appointments")
        .select("id, title, description, starts_at, ends_at, email_id, created_at")
        .eq("user_id", userId)
        .in("email_id", emailIds);
      for (const a of appts || []) {
        items.push({
          type: "appointment",
          id: `appt-${a.id}`,
          occurredAt: String((a as any).starts_at || (a as any).created_at),
          title: (a as any).title || "(rendez-vous)",
          snippet: ((a as any).description as string | null) || null,
          categoryName: null,
        });
      }
    }

    // Projets liés (via les emails de ce contact)
    const projectIds = Array.from(
      new Set(
        (emails || [])
          .map((e: any) => e.project_id)
          .filter((id: any) => id != null),
      ),
    );
    if (projectIds.length > 0) {
      const { data: projects } = await supabaseAdmin
        .from("projects")
        .select("id, name, reference, created_at, description")
        .eq("user_id", userId)
        .in("id", projectIds);
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

    items.sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1));

    res.json({ email: rawEmail, items });
  } catch (err: any) {
    req.log?.error?.({ err }, "[contacts] timeline failed");
    res.status(500).json({ error: "Failed to load timeline" });
  }
});

export default router;
