import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";
import { generateApiKey } from "../lib/api-key";

const router: IRouter = Router();

const ALLOWED_SCOPES = [
  "emails:read",
  "tasks:write",
  "appointments:write",
  "contacts:write",
  "rules:trigger",
  "brain:read",
];

router.get("/api-keys", requireAuth, async (req, res): Promise<void> => {
  try {
    const { data } = await supabaseAdmin
      .from("api_keys")
      .select("id, name, key_prefix, scopes, last_used_at, revoked_at, created_at")
      .eq("user_id", req.userId!)
      .order("created_at", { ascending: false });
    res.json((data || []).map((k: any) => ({
      id: k.id,
      name: k.name,
      keyPrefix: k.key_prefix,
      scopes: k.scopes || [],
      lastUsedAt: k.last_used_at,
      revokedAt: k.revoked_at,
      createdAt: k.created_at,
    })));
  } catch {
    res.status(500).json({ error: "Erreur lors de la récupération des clés API" });
  }
});

router.post("/api-keys", requireAuth, async (req, res): Promise<void> => {
  try {
    const { name, scopes } = req.body || {};
    if (!name || typeof name !== "string" || !name.trim()) {
      res.status(400).json({ error: "Le nom est requis" });
      return;
    }
    const requested = Array.isArray(scopes) && scopes.length > 0
      ? scopes.filter((s: string) => ALLOWED_SCOPES.includes(s))
      : ALLOWED_SCOPES;

    const { plain, prefix, hash } = generateApiKey();

    const { data, error } = await supabaseAdmin
      .from("api_keys")
      .insert({
        user_id: req.userId!,
        name: name.trim(),
        key_prefix: prefix,
        key_hash: hash,
        scopes: requested,
      })
      .select("id, name, key_prefix, scopes, created_at")
      .single();

    if (error || !data) {
      res.status(500).json({ error: "Impossible de créer la clé API" });
      return;
    }

    res.status(201).json({
      id: data.id,
      name: data.name,
      keyPrefix: data.key_prefix,
      scopes: data.scopes || [],
      createdAt: data.created_at,
      key: plain, // shown only once
    });
  } catch {
    res.status(500).json({ error: "Erreur lors de la création de la clé API" });
  }
});

router.delete("/api-keys/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const { error } = await supabaseAdmin
      .from("api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .eq("user_id", req.userId!);
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Erreur lors de la révocation" });
  }
});

router.get("/api-keys/scopes", requireAuth, (_req, res) => {
  res.json(ALLOWED_SCOPES);
});

export default router;
