-- Tâche : "Non classé" persistante (système)
-- Ajoute un drapeau is_system pour identifier la catégorie technique "Non classé"
-- où atterrissent les emails que l'IA n'arrive pas à classer automatiquement.
-- Cette catégorie est créée à la demande (idempotent) côté code dans
-- ensureSystemCategory(userId) au premier GET /api/categories de l'utilisateur.

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE;

-- Une seule catégorie système par utilisateur. L'index partiel ne couvre que
-- les lignes is_system = true, donc n'impacte pas les autres catégories.
CREATE UNIQUE INDEX IF NOT EXISTS categories_user_system_unique
  ON public.categories (user_id)
  WHERE is_system = TRUE;
