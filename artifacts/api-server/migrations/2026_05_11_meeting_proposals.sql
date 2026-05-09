-- RDV Phase 3 (#261) — Inboria organise un rendez-vous (1 à 1)
--
-- À exécuter dans le SQL Editor du Dashboard Supabase.
-- Étend `appointments` avec un cycle de vie de proposition (pending →
-- confirmed / declined / counter_proposed) et le suivi des messages mail
-- échangés, plus une planification de relance à 48h.

alter table public.appointments
  add column if not exists status text not null default 'confirmed'
    check (status in ('pending','confirmed','declined','counter_proposed','cancelled')),
  add column if not exists proposal_message_id text null,
  add column if not exists response_message_id text null,
  add column if not exists awaiting_reminder_at timestamptz null,
  add column if not exists reminder_sent_at timestamptz null,
  add column if not exists counter_start_at timestamptz null,
  add column if not exists counter_end_at timestamptz null,
  add column if not exists proposal_recipient text null,
  add column if not exists proposal_lang text null;

-- Lookup rapide depuis la détection de réponse (worker triage) : étant
-- donné l'In-Reply-To d'un mail entrant, on retrouve le RDV pending.
create index if not exists appointments_proposal_message_idx
  on public.appointments (user_id, proposal_message_id)
  where proposal_message_id is not null;

-- Filtre d'agenda par statut + cron de relance.
create index if not exists appointments_status_idx
  on public.appointments (user_id, status)
  where status <> 'confirmed';

create index if not exists appointments_awaiting_reminder_idx
  on public.appointments (awaiting_reminder_at)
  where awaiting_reminder_at is not null and reminder_sent_at is null;

-- Toggle "relances auto de RDV" exposé dans Réglages. On stocke sur
-- `profiles` aux côtés des autres préférences utilisateur. Activé par
-- défaut — l'utilisateur peut le couper à tout moment.
alter table public.profiles
  add column if not exists meeting_reminders_enabled boolean not null default true;
