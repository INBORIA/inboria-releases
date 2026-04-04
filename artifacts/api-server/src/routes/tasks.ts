import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, tasksTable, emailsTable } from "@workspace/db";
import { ListTasksQueryParams, UpdateTaskParams, UpdateTaskBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/tasks", requireAuth, async (req, res): Promise<void> => {
  const params = ListTasksQueryParams.safeParse(req.query);

  const conditions = [eq(tasksTable.userId, req.userId!)];

  if (params.success && params.data.status && params.data.status !== "all") {
    if (params.data.status === "done") {
      conditions.push(eq(tasksTable.done, true));
    } else if (params.data.status === "pending") {
      conditions.push(eq(tasksTable.done, false));
    }
  }

  const tasks = await db
    .select({
      id: tasksTable.id,
      title: tasksTable.title,
      done: tasksTable.done,
      dueDate: tasksTable.dueDate,
      emailId: tasksTable.emailId,
      emailSubject: emailsTable.subject,
      createdAt: tasksTable.createdAt,
    })
    .from(tasksTable)
    .leftJoin(emailsTable, eq(tasksTable.emailId, emailsTable.id))
    .where(and(...conditions))
    .orderBy(tasksTable.createdAt);

  res.json(tasks.map(t => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
  })));
});

router.patch("/tasks/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.done !== undefined) updates.done = parsed.data.done;
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;

  const [task] = await db
    .update(tasksTable)
    .set(updates)
    .where(and(eq(tasksTable.id, params.data.id), eq(tasksTable.userId, req.userId!)))
    .returning();

  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const [result] = await db
    .select({
      id: tasksTable.id,
      title: tasksTable.title,
      done: tasksTable.done,
      dueDate: tasksTable.dueDate,
      emailId: tasksTable.emailId,
      emailSubject: emailsTable.subject,
      createdAt: tasksTable.createdAt,
    })
    .from(tasksTable)
    .leftJoin(emailsTable, eq(tasksTable.emailId, emailsTable.id))
    .where(eq(tasksTable.id, task.id));

  res.json({
    ...result,
    createdAt: result!.createdAt.toISOString(),
  });
});

export default router;
