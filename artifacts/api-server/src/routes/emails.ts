import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, emailsTable, categoriesTable } from "@workspace/db";
import { ListEmailsQueryParams, GetEmailParams, UpdateEmailParams, UpdateEmailBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/emails", requireAuth, async (req, res): Promise<void> => {
  const params = ListEmailsQueryParams.safeParse(req.query);

  const conditions = [eq(emailsTable.userId, req.userId!)];

  if (params.success && params.data.priority) {
    conditions.push(eq(emailsTable.priority, params.data.priority));
  }
  if (params.success && params.data.categoryId) {
    conditions.push(eq(emailsTable.categoryId, params.data.categoryId));
  }
  if (params.success && params.data.status) {
    conditions.push(eq(emailsTable.status, params.data.status));
  }

  const emails = await db
    .select({
      id: emailsTable.id,
      sender: emailsTable.sender,
      senderEmail: emailsTable.senderEmail,
      subject: emailsTable.subject,
      body: emailsTable.body,
      status: emailsTable.status,
      priority: emailsTable.priority,
      summary: emailsTable.summary,
      categoryId: emailsTable.categoryId,
      categoryName: categoriesTable.name,
      createdAt: emailsTable.createdAt,
    })
    .from(emailsTable)
    .leftJoin(categoriesTable, eq(emailsTable.categoryId, categoriesTable.id))
    .where(and(...conditions))
    .orderBy(desc(emailsTable.createdAt));

  res.json(emails.map(e => ({
    ...e,
    createdAt: e.createdAt.toISOString(),
  })));
});

router.get("/emails/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetEmailParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [email] = await db
    .select({
      id: emailsTable.id,
      sender: emailsTable.sender,
      senderEmail: emailsTable.senderEmail,
      subject: emailsTable.subject,
      body: emailsTable.body,
      status: emailsTable.status,
      priority: emailsTable.priority,
      summary: emailsTable.summary,
      categoryId: emailsTable.categoryId,
      categoryName: categoriesTable.name,
      createdAt: emailsTable.createdAt,
    })
    .from(emailsTable)
    .leftJoin(categoriesTable, eq(emailsTable.categoryId, categoriesTable.id))
    .where(and(eq(emailsTable.id, params.data.id), eq(emailsTable.userId, req.userId!)));

  if (!email) {
    res.status(404).json({ error: "Email not found" });
    return;
  }

  res.json({
    ...email,
    createdAt: email.createdAt.toISOString(),
  });
});

router.patch("/emails/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateEmailParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateEmailBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.categoryId !== undefined) updates.categoryId = parsed.data.categoryId;
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;

  const [email] = await db
    .update(emailsTable)
    .set(updates)
    .where(and(eq(emailsTable.id, params.data.id), eq(emailsTable.userId, req.userId!)))
    .returning();

  if (!email) {
    res.status(404).json({ error: "Email not found" });
    return;
  }

  const [result] = await db
    .select({
      id: emailsTable.id,
      sender: emailsTable.sender,
      senderEmail: emailsTable.senderEmail,
      subject: emailsTable.subject,
      body: emailsTable.body,
      status: emailsTable.status,
      priority: emailsTable.priority,
      summary: emailsTable.summary,
      categoryId: emailsTable.categoryId,
      categoryName: categoriesTable.name,
      createdAt: emailsTable.createdAt,
    })
    .from(emailsTable)
    .leftJoin(categoriesTable, eq(emailsTable.categoryId, categoriesTable.id))
    .where(eq(emailsTable.id, email.id));

  res.json({
    ...result,
    createdAt: result!.createdAt.toISOString(),
  });
});

export default router;
