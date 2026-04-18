import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import OpenAI from "openai";
import { isNoiseEmail, userHasOpenTaskWithTitle } from "../services/auto-sync";
import { preClassifyEmail, recordAIClassification, bumpMetrics } from "../services/pre-filter";

const openai = new OpenAI({
  apiKey: process.env["OPENAI_API_KEY"],
});

const router: IRouter = Router();

function verifyWebhookSecret(req: any): boolean {
  const secret = process.env["WEBHOOK_SECRET"];
  if (!secret) return false;
  const provided =
    req.headers["x-webhook-secret"] ||
    req.headers["authorization"]?.replace("Bearer ", "") ||
    req.query.secret;
  return provided === secret;
}

async function triageEmailAI(
  sender: string,
  subject: string,
  body: string,
  userId: string
): Promise<{ priority: string; summary: string; category: string; tasks: string[] }> {
  try {
    const { data: categories } = await supabaseAdmin
      .from("categories")
      .select("name")
      .eq("user_id", userId);
    const categoryNames = (categories || []).map((c: any) => c.name);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 512,
      messages: [
        {
          role: "system",
          content:
            "Tu es un assistant de tri d'emails professionnel pour une PME. Reponds uniquement en JSON valide. Classe TOUJOURS les emails dans une categorie pertinente. Exemples: LinkedIn/reseaux sociaux → 'Reseaux sociaux', newsletters → 'Newsletters', codes de verification/securite → 'Notifications', factures/paiements → 'Facturation', hebergement/domaines → 'Hebergement'. N'utilise JAMAIS 'Non classe'.",
        },
        {
          role: "user",
          content: `Email:\nDe: ${sender}\nSujet: ${subject}\nCorps: ${(body || "").slice(0, 800)}\n\nCategories existantes: ${categoryNames.join(", ") || "Aucune"}\n\nReponds en JSON:\n{"priority":"urgent|moyen|faible","summary":"resume 1 phrase","category":"nom de categorie existante OU propose un nouveau nom pertinent (court, professionnel). Utilise 'Non classe' uniquement si vraiment inclassable.","tasks":["tache 1","tache 2"]}\n\nIMPORTANT pour les taches: Chaque tache doit etre explicite et auto-suffisante. Inclus toujours QUI (expediteur/service) et QUOI. Exemples: au lieu de "Verifier l'adresse email" → "Confirmer l'inscription sur Replit (email de verification)", au lieu de "Utiliser le code" → "Saisir le code de verification LinkedIn dans les 15 min". Ne genere PAS de tache pour les emails purement informatifs (newsletters, notifications automatiques, confirmations de lecture). Genere des taches uniquement quand une ACTION concrete est requise.`,
        },
      ],
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const result = JSON.parse(jsonMatch ? jsonMatch[0] : "{}");
    return {
      priority: result.priority || "faible",
      summary: result.summary || "",
      category: result.category || "Non classe",
      tasks: Array.isArray(result.tasks) ? result.tasks : [],
    };
  } catch (err: any) {
    console.error("webhook triageEmailAI error:", err.message);
    return { priority: "faible", summary: "", category: "Non classe", tasks: [] };
  }
}

router.post("/webhook/email", async (req, res): Promise<void> => {
  try {
    if (!verifyWebhookSecret(req)) {
      res.status(401).json({ error: "Invalid webhook secret" });
      return;
    }

    const { sender, subject, body, user_email, external_id, received_at } = req.body;

    if (!sender || !subject || !user_email) {
      res.status(400).json({
        error: "Champs requis: sender, subject, user_email",
        example: {
          sender: "Client SARL <contact@client.com>",
          subject: "Facture impayee - Urgent",
          body: "Bonjour, votre facture n.1234 est en retard...",
          user_email: "utilisateur@inboria.com",
          external_id: "msg_abc123",
          received_at: "2025-01-15T10:30:00Z",
        },
      });
      return;
    }

    const { data: connection } = await supabaseAdmin
      .from("email_connections")
      .select("user_id")
      .eq("email_address", user_email)
      .single();

    if (!connection) {
      res.status(404).json({ error: `Aucun utilisateur trouve pour ${user_email}` });
      return;
    }

    const userId = connection.user_id;

    if (external_id) {
      const { data: existing } = await supabaseAdmin
        .from("emails")
        .select("id")
        .eq("user_id", userId)
        .eq("external_id", external_id)
        .single();

      if (existing) {
        res.json({ status: "duplicate", message: "Email deja traite", emailId: existing.id });
        return;
      }
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("emails_used, emails_quota")
      .eq("id", userId)
      .single();

    if (profile && profile.emails_used >= profile.emails_quota) {
      res.status(429).json({
        error: "Quota depasse",
        used: profile.emails_used,
        quota: profile.emails_quota,
      });
      return;
    }

    const pre = await preClassifyEmail({ userId, sender, subject });
    let triage: { priority: string; summary: string; category: string; tasks: string[] };
    if (pre.hit && pre.classification) {
      triage = {
        priority: pre.classification.priority,
        summary: pre.classification.summary,
        category: pre.classification.category,
        tasks: pre.classification.tasks,
      };
      bumpMetrics(userId, pre.reason === "sender-cache" ? "cache" : "prefilter").catch(() => {});
      console.log(`[webhook] pre-filter hit (${pre.reason}) for ${sender} -> ${triage.category}`);
    } else {
      triage = await triageEmailAI(sender, subject, body || "", userId);
      bumpMetrics(userId, "ai").catch(() => {});
      recordAIClassification(userId, sender, triage.category, triage.priority).catch(() => {});
    }

    let categoryId = null;
    if (triage.category && triage.category !== "Non classe") {
      const { data: cat } = await supabaseAdmin
        .from("categories")
        .select("id")
        .eq("user_id", userId)
        .eq("name", triage.category)
        .maybeSingle();
      if (cat?.id) {
        categoryId = cat.id;
      } else {
        const { data: newCat, error: newCatErr } = await supabaseAdmin
          .from("categories")
          .insert({ user_id: userId, name: triage.category })
          .select("id")
          .single();
        if (newCat?.id) {
          categoryId = newCat.id;
        } else if (newCatErr?.code === "23505") {
          const { data: existing } = await supabaseAdmin
            .from("categories").select("id")
            .eq("user_id", userId).eq("name", triage.category).maybeSingle();
          categoryId = existing?.id || null;
        }
      }
    }

    const { data: insertedEmail, error: insertError } = await supabaseAdmin
      .from("emails")
      .insert({
        user_id: userId,
        external_id: external_id || `webhook_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        sender,
        subject,
        body: body || "",
        status: "non_lu",
        priority: triage.priority,
        summary: triage.summary,
        category_id: categoryId,
        created_at: received_at || new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("webhook insert error:", insertError);
      res.status(500).json({ error: "Erreur lors de l'enregistrement" });
      return;
    }

    if (triage.tasks.length > 0 && !isNoiseEmail(sender, subject)) {
      const { data: existingTasks } = await supabaseAdmin
        .from("tasks")
        .select("id")
        .eq("email_id", insertedEmail.id)
        .limit(1);

      if (!existingTasks || existingTasks.length === 0) {
        const taskInserts: { user_id: string; email_id: number; title: string; done: boolean }[] = [];
        for (const title of triage.tasks) {
          if (await userHasOpenTaskWithTitle(userId, title)) continue;
          taskInserts.push({ user_id: userId, email_id: insertedEmail.id, title, done: false });
        }
        if (taskInserts.length > 0) {
          await supabaseAdmin.from("tasks").insert(taskInserts);
        }
      }
    } else if (triage.tasks.length > 0) {
      console.log(`[webhook] noise email, skipping ${triage.tasks.length} task(s)`);
    }

    await supabaseAdmin
      .from("profiles")
      .update({ emails_used: (profile?.emails_used || 0) + 1 })
      .eq("id", userId);

    console.log(
      `webhook: email processed for ${user_email} | priority=${triage.priority} | category=${triage.category} | tasks=${triage.tasks.length}`
    );

    res.json({
      status: "ok",
      emailId: insertedEmail.id,
      priority: triage.priority,
      category: triage.category,
      summary: triage.summary,
      tasksCreated: triage.tasks.length,
    });
  } catch (err: any) {
    console.error("webhook error:", err);
    res.status(500).json({ error: "Erreur interne du webhook" });
  }
});

router.post("/webhook/email/batch", async (req, res): Promise<void> => {
  try {
    if (!verifyWebhookSecret(req)) {
      res.status(401).json({ error: "Invalid webhook secret" });
      return;
    }

    const { emails, user_email } = req.body;

    if (!Array.isArray(emails) || !user_email) {
      res.status(400).json({ error: "Champs requis: emails (array), user_email" });
      return;
    }

    const { data: connection } = await supabaseAdmin
      .from("email_connections")
      .select("user_id")
      .eq("email_address", user_email)
      .single();

    if (!connection) {
      res.status(404).json({ error: `Aucun utilisateur trouve pour ${user_email}` });
      return;
    }

    const results = [];
    for (const email of emails.slice(0, 50)) {
      try {
        const sender = email.sender || "Inconnu";
        const subject = email.subject || "(pas de sujet)";
        const pre = await preClassifyEmail({ userId: connection.user_id, sender, subject });
        let triage: { priority: string; summary: string; category: string; tasks: string[] };
        if (pre.hit && pre.classification) {
          triage = {
            priority: pre.classification.priority,
            summary: pre.classification.summary,
            category: pre.classification.category,
            tasks: pre.classification.tasks,
          };
          bumpMetrics(connection.user_id, pre.reason === "sender-cache" ? "cache" : "prefilter").catch(() => {});
        } else {
          triage = await triageEmailAI(sender, subject, email.body || "", connection.user_id);
          bumpMetrics(connection.user_id, "ai").catch(() => {});
          recordAIClassification(connection.user_id, sender, triage.category, triage.priority).catch(() => {});
        }

        let categoryId = null;
        if (triage.category && triage.category !== "Non classe") {
          const { data: cat } = await supabaseAdmin
            .from("categories")
            .select("id")
            .eq("user_id", connection.user_id)
            .eq("name", triage.category)
            .maybeSingle();
          if (cat?.id) {
            categoryId = cat.id;
          } else {
            const { data: newCat, error: newCatErr } = await supabaseAdmin
              .from("categories")
              .insert({ user_id: connection.user_id, name: triage.category })
              .select("id")
              .single();
            if (newCat?.id) {
              categoryId = newCat.id;
            } else if (newCatErr?.code === "23505") {
              const { data: existing } = await supabaseAdmin
                .from("categories").select("id")
                .eq("user_id", connection.user_id).eq("name", triage.category).maybeSingle();
              categoryId = existing?.id || null;
            }
          }
        }

        const { data: inserted } = await supabaseAdmin
          .from("emails")
          .insert({
            user_id: connection.user_id,
            external_id: email.external_id || `webhook_batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            sender: email.sender,
            subject: email.subject,
            body: email.body || "",
            status: "non_lu",
            priority: triage.priority,
            summary: triage.summary,
            category_id: categoryId,
            created_at: email.received_at || new Date().toISOString(),
          })
          .select("id")
          .single();

        if (triage.tasks.length > 0 && inserted) {
          const { data: existingTasks } = await supabaseAdmin
            .from("tasks")
            .select("id")
            .eq("email_id", inserted.id)
            .limit(1);

          if (!existingTasks || existingTasks.length === 0) {
            await supabaseAdmin.from("tasks").insert(
              triage.tasks.map((title) => ({
                user_id: connection.user_id,
                email_id: inserted.id,
                title,
                done: false,
              }))
            );
          }
        }

        results.push({ status: "ok", subject: email.subject, priority: triage.priority });
      } catch (err: any) {
        results.push({ status: "error", subject: email.subject, error: err.message });
      }
    }

    await supabaseAdmin
      .from("profiles")
      .update({
        emails_used:
          (
            await supabaseAdmin
              .from("profiles")
              .select("emails_used")
              .eq("id", connection.user_id)
              .single()
          ).data?.emails_used +
          results.filter((r) => r.status === "ok").length,
      })
      .eq("id", connection.user_id);

    res.json({
      status: "ok",
      processed: results.filter((r) => r.status === "ok").length,
      errors: results.filter((r) => r.status === "error").length,
      results,
    });
  } catch (err: any) {
    console.error("webhook batch error:", err);
    res.status(500).json({ error: "Erreur interne du webhook batch" });
  }
});

router.get("/webhook/test", (req, res): void => {
  if (!verifyWebhookSecret(req)) {
    res.status(401).json({ error: "Invalid webhook secret" });
    return;
  }
  res.json({
    status: "ok",
    message: "Webhook Inboria actif",
    endpoints: {
      single: "POST /api/webhook/email",
      batch: "POST /api/webhook/email/batch",
    },
    auth: "Header 'x-webhook-secret' ou 'Authorization: Bearer <secret>'",
    payload: {
      sender: "Nom <email@exemple.com>",
      subject: "Sujet de l'email",
      body: "Corps du message",
      user_email: "adresse@connectee.com",
      external_id: "optionnel_id_unique",
      received_at: "2025-01-15T10:30:00Z",
    },
  });
});

export default router;
