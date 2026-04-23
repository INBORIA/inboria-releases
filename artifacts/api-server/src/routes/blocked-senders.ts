import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";
import { logger } from "../lib/logger";
import {
  blockSenderOnProvider,
  unblockSenderOnProvider,
  type ConnectionForBlock,
} from "../services/blocked-senders";
import { recordAutopilotEvent } from "../services/autopilot-events";

const router: IRouter = Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(addr: string): string {
  return addr.trim().toLowerCase();
}

router.get("/senders/blocked", requireAuth, async (req, res): Promise<void> => {
  try {
    const connectionId = (req.query.connectionId as string | undefined) || null;
    let query = supabaseAdmin
      .from("blocked_senders")
      .select("id, connection_id, email_address, provider, provider_rule_id, scope, blocked_at")
      .eq("user_id", req.userId!)
      .order("blocked_at", { ascending: false })
      .limit(500);

    if (connectionId) query = query.eq("connection_id", connectionId);

    const { data, error } = await query;
    if (error) {
      logger.error({ service: "blocked-senders", err: error.message }, "List failed");
      res.status(500).json({ error: "Failed to list blocked senders" });
      return;
    }

    res.json(
      (data || []).map((row) => ({
        id: row.id,
        connectionId: row.connection_id,
        emailAddress: row.email_address,
        provider: row.provider,
        providerRuleId: row.provider_rule_id,
        scope: row.scope,
        blockedAt: row.blocked_at,
      })),
    );
  } catch (err: any) {
    logger.error({ service: "blocked-senders", err: err.message }, "List exception");
    res.status(500).json({ error: "Failed to list blocked senders" });
  }
});

router.post("/senders/block", requireAuth, async (req, res): Promise<void> => {
  try {
    const { email, connectionId, scope } = req.body || {};
    if (!email || typeof email !== "string" || !EMAIL_REGEX.test(email)) {
      res.status(400).json({ error: "Invalid email" });
      return;
    }
    if (!connectionId || typeof connectionId !== "string") {
      res.status(400).json({ error: "connectionId required" });
      return;
    }
    const normalizedScope: "connection" | "all_accounts" =
      scope === "all_accounts" ? "all_accounts" : "connection";
    const target = normalizeEmail(email);

    // Vérifie ownership de la connexion
    const { data: conn, error: connErr } = await supabaseAdmin
      .from("email_connections")
      .select("id, user_id, provider, email_address, access_token, refresh_token, token_expires_at")
      .eq("id", connectionId)
      .eq("user_id", req.userId!)
      .single();

    if (connErr || !conn) {
      res.status(404).json({ error: "Connection not found" });
      return;
    }

    // Détermine connexions cibles selon scope
    let targetConnections: ConnectionForBlock[] = [conn as ConnectionForBlock];
    if (normalizedScope === "all_accounts") {
      const { data: all } = await supabaseAdmin
        .from("email_connections")
        .select("id, user_id, provider, email_address, access_token, refresh_token, token_expires_at")
        .eq("user_id", req.userId!)
        .eq("status", "active");
      if (all && all.length > 0) {
        targetConnections = all as ConnectionForBlock[];
      }
    }

    const results: Array<{ connectionId: string; ok: boolean; reason?: string }> = [];

    for (const tConn of targetConnections) {
      const providerResult = await blockSenderOnProvider(tConn, target);

      // Insertion (ou no-op si déjà bloqué) — UPSERT sur (user_id, connection_id, email_address)
      const { error: insertErr } = await supabaseAdmin
        .from("blocked_senders")
        .upsert(
          {
            user_id: req.userId!,
            connection_id: tConn.id,
            email_address: target,
            provider: tConn.provider,
            provider_rule_id: providerResult.providerRuleId,
            scope: normalizedScope,
          },
          { onConflict: "user_id,connection_id,email_address" },
        );

      if (insertErr) {
        logger.error(
          { service: "blocked-senders", connId: tConn.id, err: insertErr.message },
          "Insert failed",
        );
        results.push({ connectionId: tConn.id, ok: false, reason: "db_error" });
        continue;
      }

      results.push({
        connectionId: tConn.id,
        ok: providerResult.ok,
        reason: providerResult.ok ? undefined : providerResult.reason,
      });
    }

    recordAutopilotEvent({
      userId: req.userId!,
      eventType: "sender_blocked",
      title: target,
      metadata: { scope: normalizedScope, results },
    }).catch(() => {});
    res.json({
      blocked: target,
      scope: normalizedScope,
      results,
    });
  } catch (err: any) {
    logger.error({ service: "blocked-senders", err: err.message }, "Block exception");
    res.status(500).json({ error: "Failed to block sender" });
  }
});

router.delete("/senders/blocked/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: "id required" });
      return;
    }

    const { data: row, error: fetchErr } = await supabaseAdmin
      .from("blocked_senders")
      .select("id, user_id, connection_id, provider_rule_id")
      .eq("id", id)
      .eq("user_id", req.userId!)
      .single();

    if (fetchErr || !row) {
      res.status(404).json({ error: "Blocked sender not found" });
      return;
    }

    // Récupère la connexion pour appeler le provider
    const { data: conn } = await supabaseAdmin
      .from("email_connections")
      .select("id, user_id, provider, email_address, access_token, refresh_token, token_expires_at")
      .eq("id", row.connection_id)
      .eq("user_id", req.userId!)
      .single();

    let providerOk = true;
    if (conn) {
      const result = await unblockSenderOnProvider(
        conn as ConnectionForBlock,
        row.provider_rule_id,
      );
      providerOk = result.ok;
    }

    const { error: delErr } = await supabaseAdmin
      .from("blocked_senders")
      .delete()
      .eq("id", id)
      .eq("user_id", req.userId!);

    if (delErr) {
      logger.error({ service: "blocked-senders", err: delErr.message }, "Delete failed");
      res.status(500).json({ error: "Failed to delete blocked sender" });
      return;
    }

    res.json({ ok: true, providerSync: providerOk });
  } catch (err: any) {
    logger.error({ service: "blocked-senders", err: err.message }, "Unblock exception");
    res.status(500).json({ error: "Failed to unblock sender" });
  }
});

export default router;
