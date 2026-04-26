import { supabaseAdmin } from "./supabase";

export const SYSTEM_CATEGORY_NAME = "Non classé";
export const SYSTEM_CATEGORY_DESCRIPTION =
  "Emails que l'IA n'a pas pu classer automatiquement. Classez-les manuellement quand vous avez un moment.";

export type SystemCategoryRow = {
  id: number;
  user_id: string;
  name: string;
  description: string | null;
  is_system: boolean;
};

/**
 * Garantit qu'un utilisateur dispose toujours de sa catégorie "Non classé"
 * (drapeau is_system = true). Création idempotente : si la catégorie existe
 * déjà, retourne son id sans rien faire. Si elle est créée maintenant,
 * réaffecte tous les emails orphelins (category_id IS NULL) de cet
 * utilisateur vers cette catégorie système (backfill une fois par user).
 */
export async function ensureSystemCategory(
  userId: string,
): Promise<SystemCategoryRow | null> {
  const { data: existing } = await supabaseAdmin
    .from("categories")
    .select("id, user_id, name, description, is_system")
    .eq("user_id", userId)
    .eq("is_system", true)
    .maybeSingle();

  if (existing) return existing as SystemCategoryRow;

  const { data: created, error } = await supabaseAdmin
    .from("categories")
    .insert({
      user_id: userId,
      name: SYSTEM_CATEGORY_NAME,
      description: SYSTEM_CATEGORY_DESCRIPTION,
      is_system: true,
    })
    .select("id, user_id, name, description, is_system")
    .single();

  if (error || !created) {
    const { data: retry } = await supabaseAdmin
      .from("categories")
      .select("id, user_id, name, description, is_system")
      .eq("user_id", userId)
      .eq("is_system", true)
      .maybeSingle();
    return (retry as SystemCategoryRow | null) ?? null;
  }

  await supabaseAdmin
    .from("emails")
    .update({ category_id: created.id })
    .is("category_id", null)
    .eq("user_id", userId);

  return created as SystemCategoryRow;
}

export function isSystemProtected(cat: {
  is_system?: boolean | null;
}): boolean {
  return cat.is_system === true;
}
