-- Phase 2 Contacts — table de contacts ajoutés manuellement.
-- Auto-ensure tenté au démarrage via exec_sql RPC ; ce fichier reste la
-- source de vérité à exécuter dans le SQL Editor du Dashboard Supabase.

create table if not exists public.manual_contacts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  email         text not null,
  display_name  text,
  phone         text,
  company       text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index if not exists manual_contacts_user_email_uniq
  on public.manual_contacts (user_id, lower(email));

create index if not exists manual_contacts_user_idx
  on public.manual_contacts (user_id, created_at desc);

alter table public.manual_contacts enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'manual_contacts'
      and policyname = 'Users manage their manual contacts'
  ) then
    create policy "Users manage their manual contacts"
      on public.manual_contacts
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;
