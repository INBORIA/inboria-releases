-- Task #294 — « Mes dossiers » (dossiers personnels, classement IA auto).
-- À appliquer manuellement dans Supabase SQL editor. Add-only, idempotent.
--
-- user_folders : dossiers privés à un utilisateur. Invisibles aux collègues
-- même si la boîte est partagée. Classement automatique :
--   - keywords (array de mots-clés simples) OU
--   - ai_prompt (description riche, évaluée par gpt-4o-mini)
-- email_folder_assignments : pivot many-to-many email <-> folder. Un email
-- peut appartenir à plusieurs dossiers. Source = "auto" (worker IA) ou
-- "manual" (drag-and-drop / menu contextuel).

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_folders (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         text NOT NULL,
  description  text,
  color        text,
  icon         text,
  keywords     text[] NOT NULL DEFAULT '{}'::text[],
  ai_prompt    text,
  enabled      boolean NOT NULL DEFAULT true,
  position     integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_folders_user_idx
  ON public.user_folders (user_id, position);

ALTER TABLE public.user_folders ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_folders' AND policyname = 'Users manage their folders'
  ) THEN
    CREATE POLICY "Users manage their folders"
      ON public.user_folders FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.email_folder_assignments (
  id           bigserial PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id    uuid NOT NULL REFERENCES public.user_folders(id) ON DELETE CASCADE,
  email_id     integer NOT NULL REFERENCES public.emails(id) ON DELETE CASCADE,
  source       text NOT NULL DEFAULT 'auto',
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (folder_id, email_id)
);

CREATE INDEX IF NOT EXISTS efa_user_folder_idx
  ON public.email_folder_assignments (user_id, folder_id, created_at DESC);

CREATE INDEX IF NOT EXISTS efa_email_idx
  ON public.email_folder_assignments (email_id);

ALTER TABLE public.email_folder_assignments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'email_folder_assignments' AND policyname = 'Users manage their folder assignments'
  ) THEN
    CREATE POLICY "Users manage their folder assignments"
      ON public.email_folder_assignments FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

COMMIT;
