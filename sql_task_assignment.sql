-- Inboria — Migration assignation des taches
-- A executer UNE FOIS dans Supabase Dashboard > SQL Editor

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS assigned_to_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS assigned_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON public.tasks(project_id);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tasks' AND policyname = 'Assignees can view assigned tasks'
  ) THEN
    CREATE POLICY "Assignees can view assigned tasks"
      ON public.tasks FOR SELECT
      USING (auth.uid() = assigned_to_user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tasks' AND policyname = 'Assignees can update assigned tasks'
  ) THEN
    CREATE POLICY "Assignees can update assigned tasks"
      ON public.tasks FOR UPDATE
      USING (auth.uid() = assigned_to_user_id);
  END IF;
END $$;
