-- Task #176 — Vue dossier équipe pour l'admin (RGPD-safe).
-- À exécuter dans le SQL Editor du Dashboard Supabase. L'application possède
-- aussi un auto-ensure (ensureAdminTeamAccessSchema) au démarrage qui tente
-- ces ALTER/CREATE via exec_sql RPC ; ce fichier reste la source de vérité.

-- 1. Marquage "privé" sur les emails. Quand un email est marqué privé par son
-- propriétaire, il est exclu :
--   * de la vue dossier équipe (admin → membre)
--   * de l'élargissement du contexte mémoire d'Inboria côté admin
-- Aucune obligation rétroactive : les accès passés ne sont pas effacés des
-- logs (registre d'audit immuable).
alter table public.emails add column if not exists is_private boolean not null default false;

create index if not exists emails_is_private_idx on public.emails (is_private) where is_private = true;

-- 2. Journal d'accès admin → dossier d'un coéquipier. Immuable côté
-- application (aucun endpoint DELETE n'est exposé) ; toute consultation
-- d'un dossier équipe par un admin est tracée pour le membre concerné et
-- consultable depuis Paramètres → Vie privée & accès équipe.
create table if not exists public.admin_team_access_log (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  admin_user_id uuid not null references public.profiles(id) on delete cascade,
  target_user_id uuid null references public.profiles(id) on delete set null,
  target_type text not null check (target_type in ('contact', 'inbox_overview', 'inboria_memory', 'member_inbox')),
  target_value text null,
  emails_seen_count integer not null default 0,
  action text not null default 'view',
  created_at timestamptz not null default now()
);

-- target_user_id is the strict pivot for "who is the data subject", added
-- after the initial table existed without it. Email-based target_value matching
-- is kept for legacy rows but new writes set both whenever the owner is known.
alter table public.admin_team_access_log
  add column if not exists target_user_id uuid references public.profiles(id) on delete set null;

create index if not exists admin_team_access_log_target_idx
  on public.admin_team_access_log (target_user_id, created_at desc)
  where target_user_id is not null;

-- Si la table préexistait avec l'ancien check, élargir au type 'member_inbox'
-- (utilisé pour pivoter le journal côté membre via /admin/team-access-log?scope=mine).
do $$
begin
  if exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'admin_team_access_log'
      and constraint_name = 'admin_team_access_log_target_type_check'
  ) then
    alter table public.admin_team_access_log
      drop constraint admin_team_access_log_target_type_check;
  end if;
  alter table public.admin_team_access_log
    add constraint admin_team_access_log_target_type_check
    check (target_type in ('contact', 'inbox_overview', 'inboria_memory', 'member_inbox'));
end $$;

create index if not exists admin_team_access_log_org_idx
  on public.admin_team_access_log (organisation_id, created_at desc);

create index if not exists admin_team_access_log_admin_idx
  on public.admin_team_access_log (admin_user_id, created_at desc);

-- RLS : on garde le modèle Inboria (service_role + contrôle applicatif) ;
-- ENABLE RLS pour empêcher toute lecture par anon / authenticated direct.
alter table public.admin_team_access_log enable row level security;

drop policy if exists admin_team_access_log_no_direct_access on public.admin_team_access_log;
-- Aucune policy permissive : le service_role bypasse RLS, les autres rôles
-- ne peuvent rien lire/écrire/supprimer en direct.
