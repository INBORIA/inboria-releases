-- Inboria Phase 3 — table de signaux par email pour le tri intelligent.
-- À exécuter dans le SQL Editor du Dashboard Supabase.
--
-- IMPORTANT — si une version antérieure (incomplète) de la table existe déjà,
-- on la remplace proprement. Sans données utiles à conserver à ce stade
-- (Phase 1 livrée, Phase 3 pas encore alimentée).
drop table if exists public.inboria_signals cascade;

create table if not exists public.inboria_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references public.profiles(id) on delete cascade,
  shared_mailbox_id uuid null references public.shared_mailboxes(id) on delete cascade,
  source_email_id bigint not null references public.emails(id) on delete cascade,
  contact_email text null,
  kind text not null check (kind in (
    'awaiting_response',
    'commitment_pending',
    'decision_needed',
    'escalation'
  )),
  severity smallint not null default 2 check (severity between 1 and 3),
  reason text null,
  created_at timestamptz not null default now(),
  constraint inboria_signals_scope_check check (
    (user_id is not null) or (shared_mailbox_id is not null)
  )
);

create index if not exists inboria_signals_user_email_idx
  on public.inboria_signals (user_id, source_email_id)
  where user_id is not null;

create index if not exists inboria_signals_shared_email_idx
  on public.inboria_signals (shared_mailbox_id, source_email_id)
  where shared_mailbox_id is not null;

create index if not exists inboria_signals_email_idx
  on public.inboria_signals (source_email_id);

alter table public.inboria_signals enable row level security;

drop policy if exists inboria_signals_select on public.inboria_signals;
create policy inboria_signals_select on public.inboria_signals
  for select using (
    (user_id = auth.uid())
    or (
      shared_mailbox_id is not null
      and exists (
        select 1
        from public.shared_mailbox_members m
        where m.shared_mailbox_id = inboria_signals.shared_mailbox_id
          and m.user_id = auth.uid()
      )
    )
  );

drop policy if exists inboria_signals_insert on public.inboria_signals;
create policy inboria_signals_insert on public.inboria_signals
  for insert with check (
    (user_id = auth.uid())
    or (
      shared_mailbox_id is not null
      and exists (
        select 1
        from public.shared_mailbox_members m
        where m.shared_mailbox_id = inboria_signals.shared_mailbox_id
          and m.user_id = auth.uid()
      )
    )
  );

drop policy if exists inboria_signals_delete on public.inboria_signals;
create policy inboria_signals_delete on public.inboria_signals
  for delete using (
    (user_id = auth.uid())
    or (
      shared_mailbox_id is not null
      and exists (
        select 1
        from public.shared_mailbox_members m
        where m.shared_mailbox_id = inboria_signals.shared_mailbox_id
          and m.user_id = auth.uid()
      )
    )
  );
