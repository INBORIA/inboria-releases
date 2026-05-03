-- Email Brain — Phase 1 (#214) : table de chunks vectorisés du corps complet
-- des mails, pour recherche sémantique RAG sur tout le corpus.
--
-- À exécuter dans le SQL Editor du Dashboard Supabase.
-- L'application possède un auto-probe au démarrage qui log un warning unique
-- si la table manque, sans crasher (pattern identique à inboria_signals).
--
-- pgvector est déjà actif (utilisé par inboria_facts.embedding).
-- Modèle : text-embedding-3-small (1536 dims).

-- 1. Colonne de file d'attente sur emails : NULL = à indexer.
alter table public.emails
  add column if not exists embeddings_indexed_at timestamptz null;

create index if not exists emails_embeddings_pending_idx
  on public.emails (created_at desc)
  where embeddings_indexed_at is null;

-- 2. Table des chunks.
create table if not exists public.email_chunks (
  id bigserial primary key,
  email_id bigint not null references public.emails(id) on delete cascade,
  user_id uuid null references public.profiles(id) on delete cascade,
  shared_mailbox_id uuid null references public.shared_mailboxes(id) on delete cascade,
  chunk_index smallint not null,
  content text not null,
  embedding vector(1536) not null,
  created_at timestamptz not null default now(),
  constraint email_chunks_scope_check check (
    (user_id is not null) or (shared_mailbox_id is not null)
  ),
  constraint email_chunks_email_chunk_unique unique (email_id, chunk_index)
);

create index if not exists email_chunks_email_idx
  on public.email_chunks (email_id);

create index if not exists email_chunks_user_idx
  on public.email_chunks (user_id)
  where user_id is not null;

create index if not exists email_chunks_shared_idx
  on public.email_chunks (shared_mailbox_id)
  where shared_mailbox_id is not null;

-- ivfflat pour la recherche cosine. lists=100 est un bon défaut jusqu'à
-- ~100k chunks. À monter si la table dépasse 500k lignes.
create index if not exists email_chunks_embedding_idx
  on public.email_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- 3. RLS strict — modèle Inboria : aucune policy permissive, seul le
-- service_role accède. Le contrôle d'autorisation est applicatif (filtre
-- de scope explicite dans la fonction search_email_chunks ci-dessous).
alter table public.email_chunks enable row level security;

drop policy if exists email_chunks_no_direct_access on public.email_chunks;

-- 4. Fonction SQL encapsulant le filtre scope + cosine + jointure emails.
-- Garanties :
--   * Filtre tenant strict : (user_id IN scope_user_ids) OR
--                            (shared_mailbox_id IN scope_mailbox_ids).
--     Aucune ligne hors de ce périmètre n'est jamais retournée.
--   * Si exclude_private = true (mode admin team), exclut les mails dont
--     emails.is_private = true.
--   * SECURITY DEFINER pour bypasser RLS (le service_role appelle déjà
--     en bypass mais on protège l'usage futur d'un rôle moins privilégié).
create or replace function public.search_email_chunks(
  query_vec vector(1536),
  scope_user_ids uuid[],
  scope_mailbox_ids uuid[],
  exclude_private boolean default false,
  match_limit integer default 8
)
returns table (
  email_id bigint,
  chunk_index smallint,
  content text,
  distance float,
  sender text,
  subject text,
  sent_at timestamptz,
  created_at timestamptz,
  is_private boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.email_id,
    c.chunk_index,
    c.content,
    (c.embedding <=> query_vec)::float as distance,
    e.sender,
    e.subject,
    e.sent_at,
    e.created_at,
    e.is_private
  from public.email_chunks c
  join public.emails e on e.id = c.email_id
  where (
    (scope_user_ids is not null and array_length(scope_user_ids, 1) > 0
      and c.user_id = any(scope_user_ids))
    or
    (scope_mailbox_ids is not null and array_length(scope_mailbox_ids, 1) > 0
      and c.shared_mailbox_id = any(scope_mailbox_ids))
  )
  and (not exclude_private or coalesce(e.is_private, false) = false)
  order by c.embedding <=> query_vec
  limit greatest(1, least(coalesce(match_limit, 8), 50));
$$;

-- Permission : seul le service_role peut appeler la fonction. Le contrôle
-- applicatif (passage des bons scope_user_ids / scope_mailbox_ids) est
-- responsable de l'isolation tenant.
revoke all on function public.search_email_chunks(vector, uuid[], uuid[], boolean, integer) from public;
grant execute on function public.search_email_chunks(vector, uuid[], uuid[], boolean, integer) to service_role;
