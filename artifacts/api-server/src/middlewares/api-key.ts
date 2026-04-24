import type { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { hashApiKey, isApiKeyShape } from "../lib/api-key";
import { logger } from "../lib/logger";

declare global {
  namespace Express {
    interface Request {
      apiKey?: { id: string; userId: string; scopes: string[] };
    }
  }
}

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function checkRate(keyId: string): { ok: boolean; retryAfter?: number } {
  const now = Date.now();
  const b = rateBuckets.get(keyId);
  if (!b || b.resetAt <= now) {
    rateBuckets.set(keyId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { ok: true };
  }
  if (b.count >= RATE_LIMIT_MAX) {
    return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  }
  b.count += 1;
  return { ok: true };
}

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rateBuckets.entries()) {
    if (v.resetAt <= now) rateBuckets.delete(k);
  }
}, 5 * 60_000).unref?.();

export function requireApiKey(requiredScopes: string[] = []) {
  return async function (req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const headerKey = (req.headers["x-api-key"] as string | undefined) || "";
      const auth = req.headers.authorization || "";
      const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
      const provided = headerKey || bearer;

      if (!provided || !isApiKeyShape(provided)) {
        res.status(401).json({ error: "Missing or malformed X-API-Key header" });
        return;
      }

      const hash = hashApiKey(provided);
      const { data: row, error } = await supabaseAdmin
        .from("api_keys")
        .select("id, user_id, scopes, revoked_at")
        .eq("key_hash", hash)
        .maybeSingle();

      if (error || !row) {
        res.status(401).json({ error: "Invalid API key" });
        return;
      }
      if (row.revoked_at) {
        res.status(401).json({ error: "API key has been revoked" });
        return;
      }

      const scopes: string[] = Array.isArray(row.scopes) ? row.scopes : [];
      for (const s of requiredScopes) {
        if (!scopes.includes(s)) {
          res.status(403).json({ error: `Missing required scope: ${s}` });
          return;
        }
      }

      const rate = checkRate(row.id);
      if (!rate.ok) {
        res.setHeader("Retry-After", String(rate.retryAfter || 60));
        res.status(429).json({ error: "Rate limit exceeded (60 req/min per key)" });
        return;
      }

      req.apiKey = { id: row.id, userId: row.user_id, scopes };
      req.userId = row.user_id;

      // best-effort: update last_used_at and log usage (no await impact on response)
      Promise.resolve().then(async () => {
        try {
          await supabaseAdmin
            .from("api_keys")
            .update({ last_used_at: new Date().toISOString() })
            .eq("id", row.id);
          await supabaseAdmin.from("api_key_usage").insert({
            api_key_id: row.id,
            endpoint: req.method + " " + (req.originalUrl || req.url || "").split("?")[0],
            status_code: res.statusCode || 0,
          });
        } catch (e: any) {
          logger.warn({ error: e?.message }, "[api-key] usage logging failed");
        }
      });

      next();
    } catch (e: any) {
      logger.warn({ error: e?.message }, "[api-key] middleware error");
      res.status(500).json({ error: "API key auth failed" });
    }
  };
}
