-- Flag "RDV interne" : marque les rendez-vous d'équipe sans client externe.
-- Permet de filtrer l'agenda (Tous / Avec client / Internes) et de masquer
-- les champs participants externes dans le formulaire. Phase 3 RDV.

alter table public.appointments
  add column if not exists internal boolean not null default false;

create index if not exists appointments_internal_idx
  on public.appointments (user_id, internal)
  where internal = true;
