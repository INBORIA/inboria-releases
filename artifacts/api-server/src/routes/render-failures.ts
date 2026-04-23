import { Router, type IRouter, type Request, type Response } from "express";
import { logger } from "../lib/logger";

const router: IRouter = Router();

interface RenderFailureBody {
  emailId?: number | string;
  sender?: string;
  reason?: string;
  bodyLength?: number;
}

router.post("/render-failures", (req: Request, res: Response) => {
  const { emailId, sender, reason, bodyLength } = (req.body || {}) as RenderFailureBody;
  logger.warn(
    {
      emailId: emailId ?? null,
      sender: sender ?? null,
      reason: reason ?? "unknown",
      bodyLength: bodyLength ?? null,
      service: "email-render",
    },
    "Email render failure detected — fallback to plain text",
  );
  res.status(204).end();
});

export default router;
