import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

function escapeCsv(val: any): string {
  if (val === null || val === undefined) return "";
  const str = String(val).replace(/"/g, '""');
  return str.includes(",") || str.includes('"') || str.includes("\n") ? `"${str}"` : str;
}

function toCsv(headers: string[], rows: Record<string, any>[], keys: string[]): string {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(keys.map((k) => escapeCsv(row[k])).join(","));
  }
  return lines.join("\n");
}

router.get("/export/emails", requireAuth, async (req, res): Promise<void> => {
  try {
    const status = req.query.status as string | undefined;
    let query = supabaseAdmin
      .from("emails")
      .select("id, sender, sender_email, recipient, subject, body, summary, status, priority, created_at, categories(name), projects(name, reference)")
      .eq("user_id", req.userId!)
      .is("shared_mailbox_id", null)
      .order("created_at", { ascending: false })
      .limit(5000);

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) { res.status(500).json({ error: error.message }); return; }

    const rows = (data || []).map((e: any) => ({
      id: e.id,
      date: e.created_at ? new Date(e.created_at).toLocaleDateString("fr-FR") : "",
      heure: e.created_at ? new Date(e.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "",
      expediteur: e.sender || "",
      destinataire: e.recipient || "",
      objet: e.subject || "",
      resume_ia: e.summary || "",
      statut: e.status || "",
      priorite: e.priority || "",
      categorie: e.categories?.name || "",
      projet: e.projects ? `${e.projects.reference} - ${e.projects.name}` : "",
      contenu: (e.body || "").substring(0, 500),
    }));

    const csv = toCsv(
      ["ID", "Date", "Heure", "Expéditeur", "Destinataire", "Objet", "Résumé IA", "Statut", "Priorité", "Catégorie", "Projet", "Contenu"],
      rows,
      ["id", "date", "heure", "expediteur", "destinataire", "objet", "resume_ia", "statut", "priorite", "categorie", "projet", "contenu"]
    );

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="emails_${new Date().toISOString().split("T")[0]}.csv"`);
    res.send("\uFEFF" + csv);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/export/projects", requireAuth, async (req, res): Promise<void> => {
  try {
    const { data: projects, error } = await supabaseAdmin
      .from("projects")
      .select("id, name, reference, description, status, color, created_at")
      .eq("user_id", req.userId!)
      .order("created_at", { ascending: false });

    if (error) { res.status(500).json({ error: error.message }); return; }

    const projectIds = (projects || []).map((p: any) => p.id);

    let emailCounts: Record<string, number> = {};
    if (projectIds.length > 0) {
      const { data: counts } = await supabaseAdmin
        .from("emails")
        .select("project_id")
        .in("project_id", projectIds);
      for (const c of counts || []) {
        emailCounts[c.project_id] = (emailCounts[c.project_id] || 0) + 1;
      }
    }

    const rows = (projects || []).map((p: any) => ({
      reference: p.reference || "",
      nom: p.name || "",
      description: p.description || "",
      statut: p.status || "",
      nb_emails: emailCounts[p.id] || 0,
      date_creation: p.created_at ? new Date(p.created_at).toLocaleDateString("fr-FR") : "",
    }));

    const csv = toCsv(
      ["Référence", "Nom", "Description", "Statut", "Nb Emails", "Date création"],
      rows,
      ["reference", "nom", "description", "statut", "nb_emails", "date_creation"]
    );

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="projets_${new Date().toISOString().split("T")[0]}.csv"`);
    res.send("\uFEFF" + csv);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/export/followups", requireAuth, async (req, res): Promise<void> => {
  try {
    const { data, error } = await supabaseAdmin
      .from("followups")
      .select("*, emails(sender, subject), projects(name, reference)")
      .eq("user_id", req.userId!)
      .order("created_at", { ascending: false });

    if (error) { res.status(500).json({ error: error.message }); return; }

    const today = new Date().toISOString().split("T")[0];
    const rows = (data || []).map((f: any) => ({
      titre: f.title || "",
      statut: f.status || "",
      echeance: f.due_date || "",
      en_retard: f.due_date && f.due_date < today && f.status !== "termine" ? "Oui" : "Non",
      notes: f.notes || "",
      email_objet: f.emails?.subject || "",
      email_expediteur: f.emails?.sender || "",
      projet: f.projects ? `${f.projects.reference} - ${f.projects.name}` : "",
      date_creation: f.created_at ? new Date(f.created_at).toLocaleDateString("fr-FR") : "",
    }));

    const csv = toCsv(
      ["Titre", "Statut", "Échéance", "En retard", "Notes", "Email objet", "Email expéditeur", "Projet", "Date création"],
      rows,
      ["titre", "statut", "echeance", "en_retard", "notes", "email_objet", "email_expediteur", "projet", "date_creation"]
    );

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="suivis_${new Date().toISOString().split("T")[0]}.csv"`);
    res.send("\uFEFF" + csv);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
