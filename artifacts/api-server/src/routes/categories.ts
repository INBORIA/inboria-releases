import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, categoriesTable, emailsTable } from "@workspace/db";
import { CreateCategoryBody, UpdateCategoryParams, UpdateCategoryBody, DeleteCategoryParams } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/categories", requireAuth, async (req, res): Promise<void> => {
  const categories = await db
    .select({
      id: categoriesTable.id,
      name: categoriesTable.name,
      description: categoriesTable.description,
      createdAt: categoriesTable.createdAt,
      emailCount: sql<number>`COALESCE(COUNT(${emailsTable.id}), 0)::int`,
    })
    .from(categoriesTable)
    .leftJoin(emailsTable, eq(emailsTable.categoryId, categoriesTable.id))
    .where(eq(categoriesTable.userId, req.userId!))
    .groupBy(categoriesTable.id)
    .orderBy(categoriesTable.name);

  res.json(categories.map(c => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
  })));
});

router.post("/categories", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateCategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [category] = await db.insert(categoriesTable).values({
    userId: req.userId!,
    name: parsed.data.name,
    description: parsed.data.description,
  }).returning();

  res.status(201).json({
    id: category.id,
    name: category.name,
    description: category.description,
    emailCount: 0,
    createdAt: category.createdAt.toISOString(),
  });
});

router.patch("/categories/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateCategoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateCategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;

  const [category] = await db
    .update(categoriesTable)
    .set(updates)
    .where(and(eq(categoriesTable.id, params.data.id), eq(categoriesTable.userId, req.userId!)))
    .returning();

  if (!category) {
    res.status(404).json({ error: "Category not found" });
    return;
  }

  res.json({
    id: category.id,
    name: category.name,
    description: category.description,
    emailCount: 0,
    createdAt: category.createdAt.toISOString(),
  });
});

router.delete("/categories/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteCategoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [category] = await db
    .delete(categoriesTable)
    .where(and(eq(categoriesTable.id, params.data.id), eq(categoriesTable.userId, req.userId!)))
    .returning();

  if (!category) {
    res.status(404).json({ error: "Category not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
