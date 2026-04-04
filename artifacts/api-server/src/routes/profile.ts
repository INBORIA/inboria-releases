import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { UpdateProfileBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/profile", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
  if (!user) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  res.json({
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    plan: user.plan,
    seats: user.seats,
    emailsUsed: user.emailsUsed,
    emailsQuota: user.emailsQuota,
    createdAt: user.createdAt.toISOString(),
  });
});

router.patch("/profile", requireAuth, async (req, res): Promise<void> => {
  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.fullName !== undefined) updates.fullName = parsed.data.fullName;
  if (parsed.data.plan !== undefined) {
    updates.plan = parsed.data.plan;
    const quotaMap: Record<string, number> = {
      gratuit: 50,
      solo: 3000,
      pro: 10000,
      business: 10000,
    };
    updates.emailsQuota = quotaMap[parsed.data.plan] ?? 50;
  }
  if (parsed.data.seats !== undefined) updates.seats = parsed.data.seats;

  const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, req.userId!)).returning();
  if (!user) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  res.json({
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    plan: user.plan,
    seats: user.seats,
    emailsUsed: user.emailsUsed,
    emailsQuota: user.emailsQuota,
    createdAt: user.createdAt.toISOString(),
  });
});

export default router;
