-- Task #306 phase 3 : auto-enrichissement du harness avec les vraies failles
-- prod détectées dans inboria_chat_logs (fallback déclenché OU reformulation
-- < 30s). Un cron hebdo extrait ces questions, dédupe (similarité texte), et
-- les insère ici comme « candidats ». Un admin peut ensuite les promouvoir en
-- tests réels dans challenge-inboria.ts (ou les rejeter).
--
-- Aucun contenu de mail n'est jamais inclus — uniquement la question tapée
-- par l'utilisateur (text user input) + métadonnées du signal.

create table if not exists inboria_harness_candidates (
  id uuid primary key default gen_random_uuid(),
  question_text text not null,
  question_norm text not null, -- normalisation pour dédupe (lowercase, no punctuation, trimmed)
  question_lang varchar(8) null,
  signal_kind varchar(32) not null, -- 'fallback' | 'reformulation' | 'fallback+reformulation'
  occurrences int not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  -- Échantillons d'IDs de logs source (max 5) pour audit
  sample_log_ids uuid[] not null default array[]::uuid[],
  -- Statut côté admin : pending | promoted | rejected | duplicate
  status varchar(16) not null default 'pending',
  reviewed_at timestamptz null,
  reviewed_by uuid null references auth.users(id) on delete set null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Dédupe forte : un seul candidat par (question_norm, signal_kind)
create unique index if not exists inboria_harness_candidates_norm_uniq
  on inboria_harness_candidates (question_norm, signal_kind);

create index if not exists inboria_harness_candidates_status_idx
  on inboria_harness_candidates (status, last_seen_at desc);

create index if not exists inboria_harness_candidates_occ_idx
  on inboria_harness_candidates (occurrences desc, last_seen_at desc)
  where status = 'pending';

-- RLS désactivée : table d'admin pure, accès via service role uniquement.
alter table inboria_harness_candidates enable row level security;
-- Aucune policy → bloque tout sauf service role (qui bypass RLS).

-- =============================================================================
-- Upsert atomique (utilisé par harness-enrichment.ts pour éviter N+1)
-- =============================================================================
-- Incrémente occurrences + merge sample_log_ids (max 5) + bump last_seen_at,
-- ou insère la nouvelle ligne si pas de conflit. Tout en une seule requête,
-- atomique côté Postgres.
create or replace function inboria_harness_upsert_candidate(
  p_question_text text,
  p_question_norm text,
  p_question_lang varchar,
  p_signal_kind varchar,
  p_occurrences int,
  p_log_ids uuid[]
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into inboria_harness_candidates (
    question_text, question_norm, question_lang, signal_kind,
    occurrences, sample_log_ids, status
  ) values (
    p_question_text, p_question_norm, p_question_lang, p_signal_kind,
    p_occurrences, (
      select array_agg(id) from (
        select unnest(p_log_ids) as id limit 5
      ) sub
    ), 'pending'
  )
  on conflict (question_norm, signal_kind) do update
    set occurrences = inboria_harness_candidates.occurrences + p_occurrences,
        sample_log_ids = (
          select array_agg(distinct id) from (
            select unnest(inboria_harness_candidates.sample_log_ids || p_log_ids) as id limit 5
          ) sub
        ),
        last_seen_at = now(),
        updated_at = now();
end;
$$;

revoke all on function inboria_harness_upsert_candidate(text, text, varchar, varchar, int, uuid[]) from public;
