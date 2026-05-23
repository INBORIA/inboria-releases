-- Notes internes (commentaires Business) sur un RDV. Visibles uniquement par
-- le owner + les co-organisateurs internes (table appointment_coorganizers).
-- Jamais envoyées au client. Cf. .local/tasks/notif-matrix-plans.md
-- (notif type: appointment_internal_comment, Business-only).

create table if not exists public.appointment_internal_notes (
  id bigserial primary key,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create index if not exists appt_note_appt_idx
  on public.appointment_internal_notes (appointment_id, created_at desc);
create index if not exists appt_note_user_idx
  on public.appointment_internal_notes (user_id);

alter table public.appointment_internal_notes enable row level security;
-- Service-role only (toutes lectures/écritures passent par l'API backend).
