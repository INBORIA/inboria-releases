-- RDV Phase 2 (#260) — Synchronisation bidirectionnelle Google/Outlook
--
-- À exécuter dans le SQL Editor du Dashboard Supabase.
-- Étend `appointments` avec les colonnes nécessaires pour propager un RDV
-- créé dans NCV Mail vers un calendrier externe (Google ou Outlook) via le
-- compte connecté en Phase 1, et inversement pour réimporter (cf. service
-- calendar-sync).

alter table public.appointments
  add column if not exists calendar_account_id uuid null
    references public.calendar_accounts(id) on delete set null,
  add column if not exists external_provider text null
    check (external_provider is null or external_provider in ('google','outlook','native')),
  add column if not exists external_id text null,
  add column if not exists external_calendar_id text null,
  add column if not exists organizer_email text null,
  add column if not exists last_synced_at timestamptz null,
  add column if not exists last_sync_error text null;

-- Empêche les doublons quand on réimporte un événement externe (idempotence).
create unique index if not exists appointments_external_uniq
  on public.appointments (user_id, external_provider, external_id)
  where external_id is not null;

create index if not exists appointments_calendar_account_idx
  on public.appointments (calendar_account_id)
  where calendar_account_id is not null;
