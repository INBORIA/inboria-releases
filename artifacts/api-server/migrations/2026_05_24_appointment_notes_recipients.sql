-- Notes internes RDV (Task #316) : permet de cibler la notif cloche sur un
-- sous-ensemble de membres de l'équipe (sinon notif à tous les autres
-- membres de l'organisation). La lecture reste org-wide (transparence
-- équipe), seul le routage de la notif change.
--
-- recipient_user_ids = liste des user_id ciblés. NULL ou tableau vide →
-- notif à tous les autres membres de l'org (comportement historique).

alter table public.appointment_internal_notes
  add column if not exists recipient_user_ids uuid[];

create index if not exists appt_note_recipients_idx
  on public.appointment_internal_notes using gin (recipient_user_ids);
