-- Task #306 phase 1+2 : logging exhaustif chat Inboria + signaux implicites
-- Aucun contenu de mail privé n'est logué — uniquement la question utilisateur
-- (qu'il a tapée lui-même) + des indicateurs structurels (modèle, durée,
-- fallback déclenché, citation [mail#ID] présente, etc.).

create table if not exists inboria_chat_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organisation_id uuid null,
  question_text text not null,
  question_lang varchar(8) null,
  question_length int not null default 0,
  model_used varchar(32) not null,
  iter_count int not null default 0,
  tool_calls_count int not null default 0,
  response_length int not null default 0,
  contains_mail_id boolean not null default false,
  contains_not_found_marker boolean not null default false,
  fallback_triggered boolean not null default false,
  fallback_reason varchar(32) null,
  fallback_won boolean not null default false,
  latency_ms int not null default 0,
  mode varchar(16) not null default 'personal',
  -- Signaux implicites de qualité (mis à jour a posteriori)
  was_reformulated boolean not null default false,
  reformulation_within_ms int null,
  abandoned boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists inboria_chat_logs_user_created_idx
  on inboria_chat_logs (user_id, created_at desc);

create index if not exists inboria_chat_logs_org_created_idx
  on inboria_chat_logs (organisation_id, created_at desc)
  where organisation_id is not null;

create index if not exists inboria_chat_logs_fallback_idx
  on inboria_chat_logs (created_at desc)
  where fallback_triggered = true;

create index if not exists inboria_chat_logs_reformulated_idx
  on inboria_chat_logs (created_at desc)
  where was_reformulated = true;

-- RLS : un user ne voit que ses propres logs ; admin peut tout lire via
-- service role (bypass RLS).
alter table inboria_chat_logs enable row level security;

drop policy if exists "inboria_chat_logs_user_select" on inboria_chat_logs;
create policy "inboria_chat_logs_user_select" on inboria_chat_logs
  for select using (auth.uid() = user_id);

-- Pas de policy insert/update — tout passe par service role côté backend.
