-- Email Brain — Phase 2 (#215) : tables decisions + projects inférés
--
-- À exécuter dans le SQL Editor du Dashboard Supabase.
-- Mêmes conventions que inboria_signals/inboria_episodes :
--   - scope user_id OU shared_mailbox_id (au moins un, pas les deux à la fois)
--   - RLS strict, accès via supabaseAdmin côté serveur uniquement
--   - auto-probe dans le worker : warning unique si table manquante, pas de crash

-- =========================================================================
-- 1. Table inboria_decisions
--    Décisions actées et engagements quantifiés extraits par GPT-4o-mini
--    avec confiance, montant optionnel, parties prenantes.
-- =========================================================================

create table if not exists public.inboria_decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references public.profiles(id) on delete cascade,
  shared_mailbox_id uuid null references public.shared_mailboxes(id) on delete cascade,
  source_email_id bigint not null references public.emails(id) on delete cascade,
  contact_email text not null,
  decision text not null check (char_length(decision) <= 280),
  decided_at date null,
  amount_eur numeric(14, 2) null,
  confidence numeric(3, 2) not null check (confidence >= 0 and confidence <= 1),
  parties text[] not null default '{}',
  created_at timestamptz not null default now(),
  constraint inboria_decisions_scope_check check (
    (user_id is not null) or (shared_mailbox_id is not null)
  )
);

create index if not exists inboria_decisions_user_contact_idx
  on public.inboria_decisions (user_id, contact_email, decided_at desc nulls last)
  where user_id is not null;

create index if not exists inboria_decisions_smbx_contact_idx
  on public.inboria_decisions (shared_mailbox_id, contact_email, decided_at desc nulls last)
  where shared_mailbox_id is not null;

create index if not exists inboria_decisions_source_email_idx
  on public.inboria_decisions (source_email_id);

alter table public.inboria_decisions enable row level security;

drop policy if exists inboria_decisions_select_own on public.inboria_decisions;
create policy inboria_decisions_select_own on public.inboria_decisions
  for select using (
    auth.uid() = user_id
    or exists (
      select 1 from public.shared_mailbox_members m
      where m.shared_mailbox_id = inboria_decisions.shared_mailbox_id
        and m.user_id = auth.uid()
    )
  );

-- =========================================================================
-- 2. Table inboria_projects_inferred
--    Projets détectés automatiquement à partir des mentions répétées dans
--    les mails. Le worker fusionne par nom normalisé (lowercase trim).
-- =========================================================================

create table if not exists public.inboria_projects_inferred (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references public.profiles(id) on delete cascade,
  shared_mailbox_id uuid null references public.shared_mailboxes(id) on delete cascade,
  name text not null check (char_length(name) <= 120),
  name_normalized text not null,
  summary text null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  email_count integer not null default 1,
  participants text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'stale', 'closed')),
  created_at timestamptz not null default now(),
  constraint inboria_projects_scope_check check (
    (user_id is not null) or (shared_mailbox_id is not null)
  )
);

create unique index if not exists inboria_projects_user_name_uidx
  on public.inboria_projects_inferred (user_id, name_normalized)
  where user_id is not null;

create unique index if not exists inboria_projects_smbx_name_uidx
  on public.inboria_projects_inferred (shared_mailbox_id, name_normalized)
  where shared_mailbox_id is not null;

create index if not exists inboria_projects_last_seen_idx
  on public.inboria_projects_inferred (last_seen_at desc);

alter table public.inboria_projects_inferred enable row level security;

drop policy if exists inboria_projects_select_own on public.inboria_projects_inferred;
create policy inboria_projects_select_own on public.inboria_projects_inferred
  for select using (
    auth.uid() = user_id
    or exists (
      select 1 from public.shared_mailbox_members m
      where m.shared_mailbox_id = inboria_projects_inferred.shared_mailbox_id
        and m.user_id = auth.uid()
    )
  );

-- =========================================================================
-- 3. Table jointure inboria_project_emails
--    Liste des emails associés à chaque projet inféré.
-- =========================================================================

create table if not exists public.inboria_project_emails (
  project_id uuid not null references public.inboria_projects_inferred(id) on delete cascade,
  email_id bigint not null references public.emails(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, email_id)
);

create index if not exists inboria_project_emails_email_idx
  on public.inboria_project_emails (email_id);

alter table public.inboria_project_emails enable row level security;

drop policy if exists inboria_project_emails_select_own on public.inboria_project_emails;
create policy inboria_project_emails_select_own on public.inboria_project_emails
  for select using (
    exists (
      select 1 from public.inboria_projects_inferred p
      where p.id = inboria_project_emails.project_id
        and (
          p.user_id = auth.uid()
          or exists (
            select 1 from public.shared_mailbox_members m
            where m.shared_mailbox_id = p.shared_mailbox_id
              and m.user_id = auth.uid()
          )
        )
    )
  );

-- =========================================================================
-- 4. Cache des synthèses Contact 360°
--    TTL 24h, regénération paresseuse à la lecture.
-- =========================================================================

create table if not exists public.inboria_contact_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references public.profiles(id) on delete cascade,
  shared_mailbox_id uuid null references public.shared_mailboxes(id) on delete cascade,
  contact_email text not null,
  summary_md text not null,
  generated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  constraint inboria_contact_summaries_scope_check check (
    (user_id is not null) or (shared_mailbox_id is not null)
  )
);

create unique index if not exists inboria_contact_summaries_user_uidx
  on public.inboria_contact_summaries (user_id, contact_email)
  where user_id is not null;

create unique index if not exists inboria_contact_summaries_smbx_uidx
  on public.inboria_contact_summaries (shared_mailbox_id, contact_email)
  where shared_mailbox_id is not null;

alter table public.inboria_contact_summaries enable row level security;

drop policy if exists inboria_contact_summaries_select_own on public.inboria_contact_summaries;
create policy inboria_contact_summaries_select_own on public.inboria_contact_summaries
  for select using (
    auth.uid() = user_id
    or exists (
      select 1 from public.shared_mailbox_members m
      where m.shared_mailbox_id = inboria_contact_summaries.shared_mailbox_id
        and m.user_id = auth.uid()
    )
  );
