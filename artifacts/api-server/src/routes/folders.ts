import { Router, type IRouter } from "express";
import OpenAI from "openai";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";
import { logger } from "../lib/logger";
import { getMemberMailboxIds } from "../lib/inbox-scope";
import {
  CreateFolderBody,
  UpdateFolderBody,
  GenerateFolderPromptBody,
  AssignEmailsToFolderBody,
} from "@workspace/api-zod";

/**
 * Renvoie le sous-ensemble des `emailIds` qui sont VISIBLES par `userId` :
 * - emails personnels (user_id = userId)
 * - emails assignés à userId
 * - emails d'une boîte partagée dont userId est membre
 *
 * Permet de classer dans un dossier privé un mail reçu sur une boîte
 * partagée tout en empêchant un user d'assigner des mails qu'il ne voit pas.
 */
async function filterVisibleEmailIds(
  userId: string,
  emailIds: number[],
): Promise<number[]> {
  if (emailIds.length === 0) return [];
  const memberMailboxes = await getMemberMailboxIds(userId);
  const orParts = [`user_id.eq.${userId}`, `assigned_to.eq.${userId}`];
  if (memberMailboxes.length > 0) {
    orParts.push(`shared_mailbox_id.in.(${memberMailboxes.join(",")})`);
  }
  const { data } = await supabaseAdmin
    .from("emails")
    .select("id")
    .in("id", emailIds)
    .or(orParts.join(","));
  return (data || []).map((r: any) => r.id as number);
}

const openai = new OpenAI({ apiKey: process.env["OPENAI_API_KEY"] });
const router: IRouter = Router();

// Cache de présence de la table user_folders. Évite de planter le serveur si
// la migration `2026_05_17_user_folders.sql` n'a pas encore été appliquée
// dans Supabase (cf. Gotchas replit.md).
//
// IMPORTANT : on ne mémorise QUE le succès (`true`). Si la migration est
// appliquée à chaud après un premier check négatif, le prochain appel re-
// vérifiera (avec un petit TTL pour ne pas marteler Supabase) et activera la
// feature sans nécessiter de redémarrage du backend.
let cachedHasFoldersTable = false;
let lastFoldersTableCheck = 0;
const FOLDERS_TABLE_RECHECK_MS = 30_000;
async function hasFoldersTable(): Promise<boolean> {
  if (cachedHasFoldersTable) return true;
  const now = Date.now();
  if (now - lastFoldersTableCheck < FOLDERS_TABLE_RECHECK_MS) return false;
  lastFoldersTableCheck = now;
  try {
    const { error } = await supabaseAdmin
      .from("user_folders")
      .select("id")
      .limit(1);
    if (!error) cachedHasFoldersTable = true;
  } catch {
    /* keep false, retry after TTL */
  }
  return cachedHasFoldersTable;
}

function rowToFolder(row: any, emailCount = 0) {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    color: row.color ?? null,
    icon: row.icon ?? null,
    keywords: Array.isArray(row.keywords) ? row.keywords : [],
    aiPrompt: row.ai_prompt ?? null,
    enabled: row.enabled !== false,
    position: row.position ?? 0,
    emailCount,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

router.get("/folders", requireAuth, async (req, res): Promise<void> => {
  if (!(await hasFoldersTable())) {
    res.json([]);
    return;
  }
  try {
    const { data: folders, error } = await supabaseAdmin
      .from("user_folders")
      .select("*")
      .eq("user_id", req.userId!)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) {
      logger.error({ err: error.message }, "[folders] list failed");
      res.status(500).json({ error: "Failed to list folders" });
      return;
    }
    const ids = (folders || []).map((f: any) => f.id);
    const counts: Record<string, number> = {};
    if (ids.length > 0) {
      const { data: rows } = await supabaseAdmin
        .from("email_folder_assignments")
        .select("folder_id")
        .eq("user_id", req.userId!)
        .in("folder_id", ids);
      for (const r of rows || []) {
        const fid = (r as any).folder_id;
        counts[fid] = (counts[fid] || 0) + 1;
      }
    }
    res.json((folders || []).map((f: any) => rowToFolder(f, counts[f.id] || 0)));
  } catch (e: any) {
    logger.error({ err: e?.message }, "[folders] list error");
    res.status(500).json({ error: "Failed to list folders" });
  }
});

router.post("/folders", requireAuth, async (req, res): Promise<void> => {
  if (!(await hasFoldersTable())) {
    res.status(503).json({ error: "folders_migration_missing" });
    return;
  }
  const parsed = CreateFolderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const { data, error } = await supabaseAdmin
      .from("user_folders")
      .insert({
        user_id: req.userId!,
        name: parsed.data.name.trim(),
        description: parsed.data.description ?? null,
        color: parsed.data.color ?? null,
        icon: parsed.data.icon ?? null,
        keywords: parsed.data.keywords ?? [],
        ai_prompt: parsed.data.aiPrompt ?? null,
        enabled: parsed.data.enabled !== false,
      })
      .select("*")
      .single();
    if (error || !data) {
      logger.error({ err: error?.message }, "[folders] create failed");
      res.status(500).json({ error: "Failed to create folder" });
      return;
    }
    res.status(201).json(rowToFolder(data, 0));
  } catch (e: any) {
    res.status(500).json({ error: "Failed to create folder" });
  }
});

router.patch("/folders/:id", requireAuth, async (req, res): Promise<void> => {
  if (!(await hasFoldersTable())) {
    res.status(503).json({ error: "folders_migration_missing" });
    return;
  }
  const parsed = UpdateFolderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const update: Record<string, any> = { updated_at: new Date().toISOString() };
  if (parsed.data.name !== undefined) update.name = parsed.data.name.trim();
  if (parsed.data.description !== undefined) update.description = parsed.data.description;
  if (parsed.data.color !== undefined) update.color = parsed.data.color;
  if (parsed.data.icon !== undefined) update.icon = parsed.data.icon;
  if (parsed.data.keywords !== undefined) update.keywords = parsed.data.keywords;
  if (parsed.data.aiPrompt !== undefined) update.ai_prompt = parsed.data.aiPrompt;
  if (parsed.data.enabled !== undefined) update.enabled = parsed.data.enabled;
  if (parsed.data.position !== undefined) update.position = parsed.data.position;

  const { data, error } = await supabaseAdmin
    .from("user_folders")
    .update(update)
    .eq("id", req.params.id)
    .eq("user_id", req.userId!)
    .select("*")
    .single();
  if (error || !data) {
    res.status(404).json({ error: "Folder not found" });
    return;
  }
  res.json(rowToFolder(data, 0));
});

router.delete("/folders/:id", requireAuth, async (req, res): Promise<void> => {
  if (!(await hasFoldersTable())) {
    res.status(204).end();
    return;
  }
  await supabaseAdmin
    .from("user_folders")
    .delete()
    .eq("id", req.params.id)
    .eq("user_id", req.userId!);
  res.status(204).end();
});

router.get("/folders/:id/emails", requireAuth, async (req, res): Promise<void> => {
  if (!(await hasFoldersTable())) {
    res.json({ emails: [], total: 0, page: 1, totalPages: 0 });
    return;
  }
  const limit = Math.min(200, Math.max(1, parseInt(req.query["limit"] as string, 10) || 50));
  const page = Math.max(1, parseInt(req.query["page"] as string, 10) || 1);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  // Vérifie la propriété du dossier (RLS-safe).
  const { data: owns } = await supabaseAdmin
    .from("user_folders")
    .select("id")
    .eq("id", req.params.id)
    .eq("user_id", req.userId!)
    .maybeSingle();
  if (!owns) {
    res.status(404).json({ error: "Folder not found" });
    return;
  }

  const { data: links, count } = await supabaseAdmin
    .from("email_folder_assignments")
    .select("email_id", { count: "exact" })
    .eq("user_id", req.userId!)
    .eq("folder_id", req.params.id)
    .order("created_at", { ascending: false })
    .range(from, to);

  const emailIds = (links || []).map((l: any) => l.email_id);
  if (emailIds.length === 0) {
    res.json({
      emails: [],
      total: count || 0,
      page,
      totalPages: Math.ceil((count || 0) / limit),
    });
    return;
  }

  // Re-vérification de visibilité au moment du READ : si l'user a perdu
  // l'accès à une boîte partagée depuis le classement, on n'expose plus les
  // mails. Les lignes d'assignation orphelines sont silencieusement omises.
  const visibleNow = new Set(await filterVisibleEmailIds(req.userId!, emailIds));
  const visibleEmailIds = emailIds.filter((id: number) => visibleNow.has(id));
  if (visibleEmailIds.length === 0) {
    res.json({
      emails: [],
      total: count || 0,
      page,
      totalPages: Math.ceil((count || 0) / limit),
    });
    return;
  }
  const { data: emailRows } = await supabaseAdmin
    .from("emails")
    .select("id, sender, subject, status, priority, summary, category_id, project_id, recipient, assigned_to, assigned_at, created_at, shared_mailbox_id, categories(name), projects(name, reference)")
    .in("id", visibleEmailIds)
    .order("created_at", { ascending: false });

  const emails = (emailRows || []).map((e: any) => ({
    id: e.id,
    sender: e.sender,
    subject: e.subject,
    status: e.status,
    priority: e.priority,
    summary: e.summary,
    categoryId: e.category_id,
    categoryName: e.categories?.name || null,
    projectId: e.project_id,
    projectName: e.projects?.name || null,
    projectReference: e.projects?.reference || null,
    recipient: e.recipient,
    assignedTo: e.assigned_to,
    assignedAt: e.assigned_at,
    sharedMailboxId: e.shared_mailbox_id,
    createdAt: e.created_at,
  }));

  res.json({
    emails,
    total: count || emails.length,
    page,
    totalPages: Math.ceil((count || emails.length) / limit),
  });
});

router.post("/folders/generate-prompt", requireAuth, async (req, res): Promise<void> => {
  const parsed = GenerateFolderPromptBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const { folderName, keywords = [], shortBrief = null } = parsed.data;
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 400,
      messages: [
        {
          role: "system",
          content:
            "Tu aides un utilisateur à décrire un dossier email personnel. À partir d'un nom de dossier, de mots-clés et d'un court brief, tu rédiges un PROMPT en français (3-6 phrases) destiné à un classifieur IA. Le prompt doit décrire CLAIREMENT ce qui doit aller dans ce dossier, les indices à chercher (expéditeur, sujet, contenu) et donner 1-2 contre-exemples. Réponds en JSON STRICT : {\"prompt\":\"...\"}",
        },
        {
          role: "user",
          content: `Nom du dossier : "${folderName}"
Mots-clés : ${keywords.length ? keywords.join(", ") : "(aucun)"}
Brief : ${shortBrief || "(aucun)"}

Rédige le prompt de classification.`,
        },
      ],
    });
    const content = completion.choices[0]?.message?.content ?? "{}";
    const match = content.match(/\{[\s\S]*\}/);
    const result = JSON.parse(match ? match[0] : "{}");
    const prompt = typeof result.prompt === "string" ? result.prompt.trim() : "";
    if (!prompt) {
      res.status(502).json({ error: "AI returned an empty prompt" });
      return;
    }
    res.json({ prompt });
  } catch (e: any) {
    logger.error({ err: e?.message }, "[folders] generate-prompt failed");
    res.status(500).json({ error: "Failed to generate prompt" });
  }
});

router.post("/folders/assign", requireAuth, async (req, res): Promise<void> => {
  if (!(await hasFoldersTable())) {
    res.status(503).json({ error: "folders_migration_missing" });
    return;
  }
  const parsed = AssignEmailsToFolderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { folderId, emailIds } = parsed.data;
  // Ownership check sur le dossier (RLS-safe).
  const { data: owns } = await supabaseAdmin
    .from("user_folders")
    .select("id")
    .eq("id", folderId)
    .eq("user_id", req.userId!)
    .maybeSingle();
  if (!owns) {
    res.status(404).json({ error: "Folder not found" });
    return;
  }
  const sanitized = [...new Set(emailIds.map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 500);
  if (sanitized.length === 0) {
    res.json({ assigned: 0 });
    return;
  }
  // Visibilité (perso + assignés + boîtes partagées dont user est membre).
  const visibleIds = await filterVisibleEmailIds(req.userId!, sanitized);
  if (visibleIds.length === 0) {
    res.json({ assigned: 0 });
    return;
  }
  // MOVE semantics : un email = au plus UN dossier par user.
  // Supprime toute assignation antérieure de cet user pour ces emails,
  // puis insère la nouvelle. Atomic au sens RLS (user_id scope).
  const { error: delErr } = await supabaseAdmin
    .from("email_folder_assignments")
    .delete()
    .eq("user_id", req.userId!)
    .in("email_id", visibleIds);
  if (delErr) {
    logger.error({ err: delErr.message }, "[folders] assign clear failed");
    res.status(500).json({ error: "Failed to assign emails" });
    return;
  }
  const rows = visibleIds.map((eid) => ({
    user_id: req.userId!,
    folder_id: folderId,
    email_id: eid,
    source: "manual",
  }));
  const { error } = await supabaseAdmin
    .from("email_folder_assignments")
    .insert(rows);
  if (error) {
    logger.error({ err: error.message }, "[folders] assign failed");
    res.status(500).json({ error: "Failed to assign emails" });
    return;
  }
  res.json({ assigned: visibleIds.length });
});

router.post("/folders/unassign", requireAuth, async (req, res): Promise<void> => {
  if (!(await hasFoldersTable())) {
    res.json({ removed: 0 });
    return;
  }
  const parsed = AssignEmailsToFolderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { folderId, emailIds } = parsed.data;
  const sanitized = [...new Set(emailIds.map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 500);
  if (sanitized.length === 0) {
    res.json({ removed: 0 });
    return;
  }
  const { data, error } = await supabaseAdmin
    .from("email_folder_assignments")
    .delete()
    .eq("user_id", req.userId!)
    .eq("folder_id", folderId)
    .in("email_id", sanitized)
    .select("id");
  if (error) {
    res.status(500).json({ error: "Failed to remove" });
    return;
  }
  res.json({ removed: data?.length || 0 });
});

/**
 * Best-effort auto-classification triggered after a new email is saved.
 * Always runs in background (caller should not await failures). Applies:
 *   1) keyword OR-match (case-insensitive sender+subject+summary+body),
 *   2) gpt-4o-mini single batched evaluation against folders that have
 *      `ai_prompt` set, when there's any unmatched folder.
 *
 * Skips entirely if the migration is missing.
 */
export async function classifyEmailIntoUserFolders(params: {
  userId: string;
  emailId: number;
  sender: string;
  subject: string;
  body: string;
  summary?: string | null;
}): Promise<void> {
  if (!(await hasFoldersTable())) return;
  try {
    // Move semantics : si l'email est déjà classé manuellement par l'user,
    // on respecte ce choix et on ne touche à rien.
    const { data: existing } = await supabaseAdmin
      .from("email_folder_assignments")
      .select("id")
      .eq("user_id", params.userId)
      .eq("email_id", params.emailId)
      .limit(1);
    if (existing && existing.length > 0) return;

    // Ordre déterministe = priorité utilisateur (position asc, puis created_at).
    const { data: folders } = await supabaseAdmin
      .from("user_folders")
      .select("id, name, keywords, ai_prompt, enabled, position, created_at")
      .eq("user_id", params.userId)
      .eq("enabled", true)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    if (!folders || folders.length === 0) return;

    const haystack = `${params.sender}\n${params.subject}\n${params.summary || ""}\n${(params.body || "").replace(/<[^>]+>/g, " ")}`.toLowerCase();

    // 1) Premier dossier qui matche par mots-clés (ordre user).
    let firstMatch: string | null = null;
    for (const f of folders as any[]) {
      const kws: string[] = Array.isArray(f.keywords) ? f.keywords : [];
      const kw = kws.find((k) => k && haystack.includes(String(k).toLowerCase().trim()));
      if (kw) {
        firstMatch = f.id;
        break;
      }
    }

    // 2) Fallback IA si pas de match keywords. L'IA renvoie le PREMIER dossier
    //    pertinent ; on respecte l'ordre utilisateur dans le prompt.
    if (!firstMatch) {
      const aiCandidates = (folders as any[]).filter(
        (f) => f.ai_prompt && String(f.ai_prompt).trim().length > 0,
      );
      if (aiCandidates.length > 0) {
        const list = aiCandidates
          .map((f, i) => `${i + 1}) "${f.name}" — ${String(f.ai_prompt).slice(0, 400)}`)
          .join("\n");
        try {
          const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            max_completion_tokens: 80,
            messages: [
              {
                role: "system",
                content:
                  "Tu classes un email dans AU PLUS UN dossier personnel selon des descriptions ordonnées par priorité. Sois STRICT : ne renvoie un dossier QUE si la description s'applique vraiment. En cas de doute, renvoie une chaîne vide. Réponds JSON STRICT : {\"folder\":\"nom\"} ou {\"folder\":\"\"}.",
              },
              {
                role: "user",
                content: `Email :
De: ${params.sender}
Sujet: ${params.subject}
Résumé: ${params.summary || ""}
Corps (extrait): ${(params.body || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 600)}

Dossiers candidats (ordre de priorité) :
${list}

Renvoie UN SEUL nom exact (le plus pertinent) ou "".`,
              },
            ],
          });
          const content = completion.choices[0]?.message?.content ?? "{}";
          const m = content.match(/\{[\s\S]*\}/);
          const result = JSON.parse(m ? m[0] : "{}");
          const name: string = typeof result.folder === "string" ? result.folder : "";
          if (name) {
            const f = aiCandidates.find((x: any) => String(x.name).toLowerCase() === name.toLowerCase());
            if (f) firstMatch = f.id;
          }
        } catch (e: any) {
          logger.warn({ err: e?.message, emailId: params.emailId }, "[folders] AI classify failed");
        }
      }
    }

    if (!firstMatch) return;
    await supabaseAdmin
      .from("email_folder_assignments")
      .insert({
        user_id: params.userId,
        folder_id: firstMatch,
        email_id: params.emailId,
        source: "auto",
      });
  } catch (e: any) {
    logger.warn({ err: e?.message, emailId: params.emailId }, "[folders] classify failed");
  }
}

export default router;
