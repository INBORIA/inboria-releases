import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";

function parseSender(raw: string) {
  const match = raw.match(/^(.+?)\s*<(.+?)>$/);
  return {
    name: match ? match[1].trim().replace(/^"|"$/g, "") : raw,
    email: match ? match[2].trim() : raw,
  };
}

const router: IRouter = Router();

router.get("/emails", requireAuth, async (req, res): Promise<void> => {
  try {
    let query = supabaseAdmin
      .from("emails")
      .select("*, categories(name)")
      .eq("user_id", req.userId!)
      .order("created_at", { ascending: false });

    if (req.query.priority) {
      query = query.eq("priority", req.query.priority as string);
    }
    if (req.query.categoryId) {
      query = query.eq("category_id", req.query.categoryId as string);
    }
    if (req.query.status) {
      query = query.eq("status", req.query.status as string);
    }

    const { data: emails, error } = await query;

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json((emails || []).map((e: any) => {
      const s = parseSender(e.sender || "");
      return {
        id: e.id,
        sender: s.name,
        senderEmail: s.email,
        subject: e.subject,
        body: e.body,
        status: e.status,
        priority: e.priority || "faible",
        summary: e.summary,
        categoryId: e.category_id,
        categoryName: e.categories?.name || null,
        createdAt: e.created_at,
      };
    }));
  } catch {
    res.status(500).json({ error: "Failed to list emails" });
  }
});

router.get("/emails/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const { data: email, error } = await supabaseAdmin
      .from("emails")
      .select("*, categories(name)")
      .eq("id", req.params.id)
      .eq("user_id", req.userId!)
      .single();

    if (error || !email) {
      res.status(404).json({ error: "Email not found" });
      return;
    }

    const s = parseSender(email.sender || "");
    res.json({
      id: email.id,
      sender: s.name,
      senderEmail: s.email,
      subject: email.subject,
      body: email.body,
      status: email.status,
      priority: email.priority || "faible",
      summary: email.summary,
      categoryId: email.category_id,
      categoryName: email.categories?.name || null,
      createdAt: email.created_at,
    });
  } catch {
    res.status(500).json({ error: "Failed to get email" });
  }
});

router.patch("/emails/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const { data: oldEmail } = await supabaseAdmin
      .from("emails")
      .select("sender, priority, category_id")
      .eq("id", req.params.id)
      .eq("user_id", req.userId!)
      .single();

    const updates: Record<string, unknown> = {};
    if (req.body.categoryId !== undefined) updates.category_id = req.body.categoryId;
    if (req.body.status !== undefined) updates.status = req.body.status;
    if (req.body.priority !== undefined) updates.priority = req.body.priority;

    const { data: email, error } = await supabaseAdmin
      .from("emails")
      .update(updates)
      .eq("id", req.params.id)
      .eq("user_id", req.userId!)
      .select("*, categories(name)")
      .single();

    if (error || !email) {
      res.status(404).json({ error: "Email not found" });
      return;
    }

    if (oldEmail && (req.body.priority || req.body.categoryId !== undefined)) {
      const senderRaw = oldEmail.sender || "";
      const emailMatch = senderRaw.match(/<(.+?)>/);
      const senderDomain = emailMatch ? emailMatch[1].split("@")[1] : senderRaw.split("@")[1] || senderRaw;

      if (senderDomain) {
        const ruleUpdate: Record<string, unknown> = {
          user_id: req.userId!,
          sender_pattern: senderDomain,
        };
        if (req.body.priority) ruleUpdate.forced_priority = req.body.priority;
        if (req.body.categoryId !== undefined) {
          const catName = email.categories?.name || null;
          if (catName) ruleUpdate.forced_category = catName;
        }

        const { data: existingRule } = await supabaseAdmin
          .from("ai_rules")
          .select("id")
          .eq("user_id", req.userId!)
          .eq("sender_pattern", senderDomain)
          .maybeSingle();

        if (existingRule) {
          const ruleFields: Record<string, unknown> = {};
          if (ruleUpdate.forced_priority) ruleFields.forced_priority = ruleUpdate.forced_priority;
          if (ruleUpdate.forced_category) ruleFields.forced_category = ruleUpdate.forced_category;
          await supabaseAdmin.from("ai_rules").update(ruleFields).eq("id", existingRule.id);
        } else {
          await supabaseAdmin.from("ai_rules").insert(ruleUpdate);
        }
      }
    }

    const s = parseSender(email.sender || "");
    res.json({
      id: email.id,
      sender: s.name,
      senderEmail: s.email,
      subject: email.subject,
      body: email.body,
      status: email.status,
      priority: email.priority || "faible",
      summary: email.summary,
      categoryId: email.category_id,
      categoryName: email.categories?.name || null,
      createdAt: email.created_at,
    });
  } catch {
    res.status(500).json({ error: "Failed to update email" });
  }
});

router.delete("/emails/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const { error } = await supabaseAdmin
      .from("emails")
      .delete()
      .eq("id", req.params.id)
      .eq("user_id", req.userId!);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete email" });
  }
});

export default router;
