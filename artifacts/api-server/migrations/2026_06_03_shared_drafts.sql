-- T005 — Brouillons partagés / co-rédaction temps réel (Inboria)
-- À APPLIQUER MANUELLEMENT dans Supabase (SQL Editor).
-- Sans cette table, les routes /api/drafts répondent en mode dégradé (no-op / liste vide)
-- grâce au cache hasDraftsTable() côté backend.

create table if not exists public.shared_drafts (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  shared_mailbox_id uuid,
  email_id bigint,
  created_by uuid not null,
  updated_by uuid not null,
  to_addr text not null default '',
  cc_addr text not null default '',
  subject text not null default '',
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shared_drafts_org_idx
  on public.shared_drafts (organisation_id);

-- Un seul brouillon partagé par (organisation, email) → empêche les doublons
-- en cas d'activation simultanée par deux membres (la 2e tentative reçoit 23505
-- et le backend re-récupère le brouillon gagnant). Les brouillons sans email
-- (email_id null) ne sont pas contraints.
create unique index if not exists shared_drafts_org_email_unique
  on public.shared_drafts (organisation_id, email_id)
  where email_id is not null;

alter table public.shared_drafts enable row level security;

-- Tout membre de la même organisation peut lire/écrire les brouillons partagés.
drop policy if exists shared_drafts_org_select on public.shared_drafts;
create policy shared_drafts_org_select on public.shared_drafts
  for select using (
    organisation_id in (
      select organisation_id from public.profiles where id = auth.uid()
    )
  );

drop policy if exists shared_drafts_org_insert on public.shared_drafts;
create policy shared_drafts_org_insert on public.shared_drafts
  for insert with check (
    organisation_id in (
      select organisation_id from public.profiles where id = auth.uid()
    )
  );

drop policy if exists shared_drafts_org_update on public.shared_drafts;
create policy shared_drafts_org_update on public.shared_drafts
  for update using (
    organisation_id in (
      select organisation_id from public.profiles where id = auth.uid()
    )
  );

drop policy if exists shared_drafts_org_delete on public.shared_drafts;
create policy shared_drafts_org_delete on public.shared_drafts
  for delete using (
    organisation_id in (
      select organisation_id from public.profiles where id = auth.uid()
    )
  );
