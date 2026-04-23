import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/auth";
import { logger } from "../lib/logger";
import { getActivitySnapshot } from "../services/autopilot-events";

const router: IRouter = Router();

router.get("/autopilot/activity", requireAuth, async (req, res): Promise<void> => {
  try {
    const snapshot = await getActivitySnapshot(req.userId!);
    res.json(snapshot);
  } catch (err: any) {
    logger.error({ service: "autopilot", err: err?.message }, "Activity fetch failed");
    res.status(500).json({ error: "Failed to load autopilot activity" });
  }
});

export default router;
