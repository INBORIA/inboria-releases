-- Phase 1 « Vue Partagées type Missive » : on isole les nouveaux emails
-- (post-connexion) des emails historiques pour ne pas noyer un nouveau
-- client avec 2000 anciens mails marqués « non pris en charge ».
--
-- Les filtres « Non pris en charge », « SLA dépassé », « Reportés »
-- côté frontend ignorent tout email reçu avant tracking_started_at.
-- Le filtre « Tous » reste exhaustif (historique complet).
alter table public.shared_mailboxes
  add column if not exists tracking_started_at timestamptz;

alter table public.shared_mailboxes
  alter column tracking_started_at set default now();

-- Pour les boîtes existantes (test) : on démarre le tracking maintenant,
-- les emails antérieurs ne sont visibles que via le filtre « Tous ».
update public.shared_mailboxes
  set tracking_started_at = now()
  where tracking_started_at is null;
