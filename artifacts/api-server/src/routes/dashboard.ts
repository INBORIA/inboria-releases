import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, usersTable, emailsTable, categoriesTable, tasksTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/dashboard/summary", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const [emailStats] = await db
    .select({
      total: sql<number>`COUNT(*)::int`,
      urgent: sql<number>`COUNT(*) FILTER (WHERE ${emailsTable.priority} = 'urgent')::int`,
      moyen: sql<number>`COUNT(*) FILTER (WHERE ${emailsTable.priority} = 'moyen')::int`,
      faible: sql<number>`COUNT(*) FILTER (WHERE ${emailsTable.priority} = 'faible')::int`,
    })
    .from(emailsTable)
    .where(eq(emailsTable.userId, req.userId!));

  const [taskStats] = await db
    .select({
      pending: sql<number>`COUNT(*) FILTER (WHERE ${tasksTable.done} = false)::int`,
    })
    .from(tasksTable)
    .where(eq(tasksTable.userId, req.userId!));

  res.json({
    totalEmails: emailStats?.total ?? 0,
    urgentCount: emailStats?.urgent ?? 0,
    moyenCount: emailStats?.moyen ?? 0,
    faibleCount: emailStats?.faible ?? 0,
    pendingTasks: taskStats?.pending ?? 0,
    emailsUsed: user.emailsUsed,
    emailsQuota: user.emailsQuota,
    plan: user.plan,
  });
});

router.get("/dashboard/inbox-health", requireAuth, async (req, res): Promise<void> => {
  const [stats] = await db
    .select({
      total: sql<number>`COUNT(*)::int`,
      urgent: sql<number>`COUNT(*) FILTER (WHERE ${emailsTable.priority} = 'urgent')::int`,
      unread: sql<number>`COUNT(*) FILTER (WHERE ${emailsTable.status} = 'classe')::int`,
    })
    .from(emailsTable)
    .where(eq(emailsTable.userId, req.userId!));

  const total = stats?.total ?? 0;
  const urgent = stats?.urgent ?? 0;
  const unread = stats?.unread ?? 0;

  let score = 100;
  if (total > 0) {
    const urgentRatio = urgent / total;
    const unreadRatio = unread / total;
    score = Math.max(0, Math.round(100 - urgentRatio * 40 - unreadRatio * 30));
  }

  let label = "Excellent";
  if (score < 40) label = "Critique";
  else if (score < 60) label = "A ameliorer";
  else if (score < 80) label = "Correct";

  res.json({
    score,
    label,
    urgentUnread: urgent,
    oldestUnanswered: null,
  });
});

router.get("/dashboard/category-counts", requireAuth, async (req, res): Promise<void> => {
  const counts = await db
    .select({
      categoryId: categoriesTable.id,
      categoryName: categoriesTable.name,
      count: sql<number>`COUNT(${emailsTable.id})::int`,
    })
    .from(categoriesTable)
    .leftJoin(emailsTable, and(
      eq(emailsTable.categoryId, categoriesTable.id),
      eq(emailsTable.userId, req.userId!)
    ))
    .where(eq(categoriesTable.userId, req.userId!))
    .groupBy(categoriesTable.id, categoriesTable.name);

  res.json(counts);
});

export default router;
