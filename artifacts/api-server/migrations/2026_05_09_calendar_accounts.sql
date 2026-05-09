-- RDV Phase 1 (#259) — Connexion calendriers Google et Outlook
--
-- À exécuter dans le SQL Editor du Dashboard Supabase.
-- Crée la table `calendar_accounts` qui stocke les calendriers connectés
-- (Google Calendar / Microsoft Outlook Calendar) séparément des
-- `email_connections`. Les tokens OAuth sont stockés tels que retournés
-- par les fournisseurs (même convention que `email_connections`).
--
-- Conventions :
--   - scope user_id (un calendrier par utilisateur, pas partagé pour l'instant)
--   - RLS strict, accès via supabaseAdmin côté serveur uniquement
--   - le serveur fait un auto-probe au démarrage et logge un warning si la
--     table est manquante (pas de crash)

create table if not exists public.calendar_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('google', 'outlook')),
  email_address text not null,
  access_token text not null,
  refresh_token text null,
  token_expires_at timestamptz null,
  scope text null,
  status text not null default 'connected' check (status in ('connected', 'reauth_required', 'error')),
  last_error_message text null,
  last_error_at timestamptz null,
  consecutive_failures int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists calendar_accounts_user_provider_email_uniq
  on public.calendar_accounts (user_id, provider, email_address);

create index if not exists calendar_accounts_user_id_idx
  on public.calendar_accounts (user_id);

alter table public.calendar_accounts enable row level security;

-- Pas de policy : accès uniquement via supabaseAdmin (service role bypass RLS).

-- updated_at auto
create or replace function public.calendar_accounts_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists calendar_accounts_set_updated_at_trg on public.calendar_accounts;
create trigger calendar_accounts_set_updated_at_trg
  before update on public.calendar_accounts
  for each row execute function public.calendar_accounts_set_updated_at();
