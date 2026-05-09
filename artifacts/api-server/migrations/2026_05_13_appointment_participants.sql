-- RDV Phase 5 (#263) — Multi-participants avec créneau commun
--
-- Table dédiée pour suivre individuellement chaque participant d'un RDV
-- (statut RSVP, dernière relance envoyée, requis ou facultatif). Le champ
-- `participants` (texte CSV) sur `appointments` reste pour rétro-compat ;
-- la nouvelle table fait foi pour la Phase 5.

create table if not exists public.appointment_participants (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  email text not null,
  name text null,
  is_required boolean not null default true,
  response_status text not null default 'pending'
    check (response_status in ('pending','accepted','declined','tentative')),
  responded_at timestamptz null,
  last_reminder_sent_at timestamptz null,
  reminder_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists appointment_participants_unique_idx
  on public.appointment_participants (appointment_id, lower(email));

create index if not exists appointment_participants_pending_idx
  on public.appointment_participants (appointment_id, response_status)
  where response_status = 'pending';

create index if not exists appointment_participants_reminder_idx
  on public.appointment_participants (last_reminder_sent_at)
  where response_status = 'pending';

-- Permet de figer un statut multi (pending / partially_confirmed / confirmed)
-- distinct du `status` de proposition existant pour ne pas casser Phase 3.
alter table public.appointments
  add column if not exists multi_status text null
    check (multi_status in ('pending','partially_confirmed','confirmed','declined') or multi_status is null),
  add column if not exists is_multi boolean not null default false;

comment on column public.appointments.multi_status is
  'Phase 5 : statut consolidé pour les RDV multi-participants. NULL pour les RDV mono.';
comment on column public.appointments.is_multi is
  'Phase 5 : true si le RDV a 2 participants ou plus (hors organisateur).';
