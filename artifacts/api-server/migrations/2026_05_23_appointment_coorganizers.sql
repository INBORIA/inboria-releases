-- Co-organisateurs internes (Business) sur un RDV. Permet d'inviter d'autres
-- membres de l'organisation à recevoir les notifs RDV (client a confirmé /
-- refusé / contre-proposé, rappel imminent) sans qu'ils soient destinataires
-- du mail côté client. Cf. matrice notifs (.local/tasks/notif-matrix-plans.md).

create table if not exists public.appointment_coorganizers (
  id bigserial primary key,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  added_by uuid references auth.users(id) on delete set null,
  added_at timestamptz not null default now(),
  unique (appointment_id, user_id)
);

create index if not exists appt_coorg_appt_idx
  on public.appointment_coorganizers (appointment_id);
create index if not exists appt_coorg_user_idx
  on public.appointment_coorganizers (user_id);

alter table public.appointment_coorganizers enable row level security;

-- Service-role only (toutes les écritures + lectures passent par l'API
-- backend qui check l'appartenance à l'organisation avant de laisser
-- modifier).
