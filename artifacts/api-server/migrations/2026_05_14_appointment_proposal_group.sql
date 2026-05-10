-- Multi-créneaux : un seul mail propose N créneaux. Toutes les lignes
-- appointments créées partagent un proposal_group_id pour qu'à la réponse
-- le classifier puisse résoudre quel slot a été accepté et nettoyer les
-- frères (DELETE pour accept, declined pour decline_all, counter sur 1
-- ligne et declined sur les autres pour counter).
alter table public.appointments
  add column if not exists proposal_group_id uuid null;

create index if not exists appointments_proposal_group_idx
  on public.appointments (user_id, proposal_group_id)
  where proposal_group_id is not null;
