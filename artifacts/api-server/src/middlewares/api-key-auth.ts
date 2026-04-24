import type { Request, Response, NextFunction } from "express";
import { resolveApiKey } from "../services/public-api-keys";

declare global {
  namespace Express {
    interface Request {
      apiKeyScopes?: string[];
    }
  }
}

function extractKey(req: Request): string | null {
  const header = req.headers.authorization;
  if (header && typeof header === "string" && header.startsWith("Bearer ")) {
    return header.slice(7).trim();
  }
  const headerXKey = req.headers["x-api-key"];
  if (typeof headerXKey === "string") return headerXKey.trim();
  return null;
}

export function requireApiKey(requiredScope: "read" | "write" = "read") {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = extractKey(req);
    if (!key) {
      res.status(401).json({ error: "Missing API key. Use Authorization: Bearer <key> or X-API-Key header." });
      return;
    }
    const resolved = await resolveApiKey(key);
    if (!resolved) {
      res.status(401).json({ error: "Invalid or revoked API key" });
      return;
    }
    if (!resolved.scopes.includes(requiredScope)) {
      res.status(403).json({ error: `Missing required scope: ${requiredScope}` });
      return;
    }
    req.userId = resolved.userId;
    req.apiKeyScopes = resolved.scopes;
    next();
  };
}
