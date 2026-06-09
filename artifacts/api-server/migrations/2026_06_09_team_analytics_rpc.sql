-- =============================================================================
-- inboria_team_analytics : agrégation CÔTÉ BASE des statistiques équipe.
-- Remplace le chargement en mémoire de jusqu'à 50 000 emails dans
-- artifacts/api-server/src/routes/analytics.ts (endpoint GET /analytics/team).
--
-- Reproduit À L'IDENTIQUE les indicateurs du handler in-memory (conservé en
-- fallback côté Node : si cette fonction est absente / erreur, l'endpoint
-- retombe automatiquement sur l'ancien calcul -> zéro régression).
--
-- La résolution des NOMS (profils, mailboxes, projets) et le bloc SLA restent
-- côté Node : cette fonction ne renvoie que des IDs + des nombres agrégés.
--
-- Idempotent : CREATE OR REPLACE, additif, ne modifie AUCUNE donnée.
-- Modes : p_handled_enabled = true  -> colonnes handled_at / handled_by
--          p_handled_enabled = false -> proxy legacy claimed_at/assigned_at/
--                                       inboria_processed_at + assigned_to/claimed_by
-- =============================================================================

create or replace function inboria_team_analytics(
  p_member_ids uuid[],
  p_mailbox_ids uuid[],
  p_since timestamptz,
  p_member uuid default null,
  p_mailbox uuid default null,
  p_project uuid default null,
  p_handled_enabled boolean default true,
  p_days integer default 30
)
returns jsonb
language plpgsql
stable
as $$
declare
  result jsonb;
  v_today date := (now() at time zone 'utc')::date;
begin
  with e as (
    select
      em.id,
      em.sender,
      em.status,
      em.assigned_to,
      em.claimed_by,
      em.category_id,
      em.project_id,
      em.shared_mailbox_id,
      em.created_at,
      em.user_id,
      em.handled_at,
      em.handled_by,
      em.claimed_at,
      em.assigned_at,
      em.inboria_processed_at,
      -- gestionnaire "Traité" : handled_by si moderne (et handled_at présent),
      -- sinon proxy assigned_to||claimed_by.
      case when p_handled_enabled
           then (case when em.handled_at is not null then em.handled_by else null end)
           else coalesce(em.assigned_to, em.claimed_by)
      end as handler_id,
      -- horodatage de traitement.
      case when p_handled_enabled
           then em.handled_at
           else coalesce(em.claimed_at, em.assigned_at, em.inboria_processed_at)
      end as handled_ts,
      -- minutes de réponse pour mailbox/projet (float, >0 et <43200) :
      --  moderne -> seulement les emails handled_at ; legacy -> seulement archived via proxy.
      case
        when p_handled_enabled then (
          case when em.handled_at is not null and em.created_at is not null
               then extract(epoch from (em.handled_at - em.created_at)) / 60.0 end)
        else (
          case when em.status = 'archived' and em.created_at is not null
                    and coalesce(em.claimed_at, em.assigned_at, em.inboria_processed_at) is not null
               then extract(epoch from (coalesce(em.claimed_at, em.assigned_at, em.inboria_processed_at) - em.created_at)) / 60.0 end)
      end as resp_mp_min,
      -- minutes de réponse pour boîte perso (float, basé sur handled_ts).
      case when (case when p_handled_enabled then em.handled_at
                      else coalesce(em.claimed_at, em.assigned_at, em.inboria_processed_at) end) is not null
                and em.created_at is not null
           then extract(epoch from ((case when p_handled_enabled then em.handled_at
                                          else coalesce(em.claimed_at, em.assigned_at, em.inboria_processed_at) end) - em.created_at)) / 60.0
      end as resp_personal_min
    from emails em
    where em.created_at >= p_since
      and em.status <> 'supprime'
      and (
        em.user_id = any(p_member_ids)
        or (array_length(p_mailbox_ids, 1) is not null and em.shared_mailbox_id = any(p_mailbox_ids))
      )
      and (
        p_member is null
        or (p_handled_enabled and em.handled_by = p_member)
        or (not p_handled_enabled and (em.assigned_to = p_member or em.claimed_by = p_member))
      )
      and (p_mailbox is null or em.shared_mailbox_id = p_mailbox)
      and (p_project is null or em.project_id = p_project)
  ),

  members as (
    select uid, ord from unnest(p_member_ids) with ordinality as u(uid, ord)
  ),

  -- ===================== TOTALS =====================
  totals as (
    select
      count(*)::int as emails,
      count(*) filter (where assigned_to is not null)::int as assigned,
      count(*) filter (where handled_ts is not null)::int as handled,
      coalesce(sum(greatest(0, floor(extract(epoch from (handled_ts - created_at)) / 60))::int)
        filter (where handled_ts is not null and created_at is not null
                and greatest(0, floor(extract(epoch from (handled_ts - created_at)) / 60)) < 43200), 0)::bigint as hdsum,
      count(*) filter (where handled_ts is not null and created_at is not null
                and greatest(0, floor(extract(epoch from (handled_ts - created_at)) / 60)) < 43200)::int as hdcount
    from e
  ),

  -- ===================== PER MEMBER =====================
  pm_handled as (
    select handler_id as uid, count(*)::int as handled
    from e where handler_id = any(p_member_ids)
    group by handler_id
  ),
  pm_assigned as (
    select assigned_to as uid, count(*)::int as assigned
    from e where assigned_to = any(p_member_ids)
    group by assigned_to
  ),
  -- délai moyen de réponse par membre : moderne -> floor minutes, borne <43200 ;
  -- legacy -> floor minutes (clampé >=0), AUCUNE borne haute (parité Node).
  pm_resp as (
    select uid, sum(diff)::bigint as s, count(*)::int as n
    from (
      select
        case when p_handled_enabled then handled_by else coalesce(assigned_to, claimed_by) end as uid,
        greatest(0, floor(extract(epoch from (
          (case when p_handled_enabled then handled_at
                else coalesce(claimed_at, assigned_at, inboria_processed_at) end) - created_at)) / 60))::int as diff
      from e
      where created_at is not null
        and (
          (p_handled_enabled and handled_at is not null and handled_by = any(p_member_ids))
          or (not p_handled_enabled and coalesce(assigned_to, claimed_by) = any(p_member_ids)
              and coalesce(claimed_at, assigned_at, inboria_processed_at) is not null)
        )
    ) q
    where (p_handled_enabled and diff < 43200) or (not p_handled_enabled)
    group by uid
  ),
  -- charge ouverte (snapshot, NON borné à la période).
  pm_open as (
    select assigned_to as uid, count(*)::int as openload
    from emails
    where assigned_to = any(p_member_ids)
      and status not in ('archived', 'supprime', 'trashed', 'done')
      and (not p_handled_enabled or handled_at is null)
    group by assigned_to
  ),
  per_member as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'userId', m.uid,
      'handled', coalesce(h.handled, 0),
      'assigned', coalesce(a.assigned, 0),
      'openLoad', coalesce(o.openload, 0),
      'avgFirstResponseMinutes', case when coalesce(r.n, 0) > 0 then round(r.s::numeric / r.n)::int else null end
    ) order by m.ord) filter (where p_member is null or m.uid = p_member), '[]'::jsonb) as data
    from members m
    left join pm_handled h on h.uid = m.uid
    left join pm_assigned a on a.uid = m.uid
    left join pm_open o on o.uid = m.uid
    left join pm_resp r on r.uid = m.uid
  ),

  -- ===================== PER MAILBOX =====================
  per_mailbox as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'mailboxId', mid,
      'count', cnt,
      'received', cnt,
      'handled', handled,
      'notHandled', greatest(0, cnt - handled),
      'avgFirstResponseMinutes', case when respn > 0 then round(respsum / respn)::int else null end
    ) order by cnt desc, mid), '[]'::jsonb) as data
    from (
      select
        shared_mailbox_id as mid,
        count(*)::int as cnt,
        count(*) filter (where p_handled_enabled and handled_at is not null)::int as handled,
        coalesce(sum(resp_mp_min) filter (where resp_mp_min > 0 and resp_mp_min < 43200), 0)::numeric as respsum,
        count(*) filter (where resp_mp_min > 0 and resp_mp_min < 43200)::int as respn
      from e where shared_mailbox_id is not null
      group by shared_mailbox_id
    ) z
  ),

  -- ===================== PER PERSONAL MAILBOX =====================
  per_personal as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'userId', uid,
      'received', cnt,
      'handled', handled,
      'notHandled', greatest(0, cnt - handled),
      'avgFirstResponseMinutes', case when respn > 0 then round(respsum / respn)::int else null end
    ) order by cnt desc, uid), '[]'::jsonb) as data
    from (
      select
        user_id as uid,
        count(*)::int as cnt,
        count(*) filter (where handled_ts is not null)::int as handled,
        coalesce(sum(resp_personal_min) filter (where resp_personal_min > 0 and resp_personal_min < 43200), 0)::numeric as respsum,
        count(*) filter (where resp_personal_min > 0 and resp_personal_min < 43200)::int as respn
      from e where shared_mailbox_id is null and user_id = any(p_member_ids)
      group by user_id
    ) z
  ),

  -- ===================== PER PROJECT =====================
  per_project as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'projectId', pid,
      'count', cnt,
      'received', cnt,
      'handled', handled,
      'notHandled', greatest(0, cnt - handled),
      'avgFirstResponseMinutes', case when respn > 0 then round(respsum / respn)::int else null end
    ) order by cnt desc, pid), '[]'::jsonb) as data
    from (
      select
        project_id as pid,
        count(*)::int as cnt,
        count(*) filter (where p_handled_enabled and handled_at is not null)::int as handled,
        coalesce(sum(resp_mp_min) filter (where resp_mp_min > 0 and resp_mp_min < 43200), 0)::numeric as respsum,
        count(*) filter (where resp_mp_min > 0 and resp_mp_min < 43200)::int as respn
      from e where project_id is not null
      group by project_id
    ) z
  ),

  -- ===================== TOP SENDERS =====================
  top_senders as (
    select coalesce(jsonb_agg(jsonb_build_object('email', email, 'count', c) order by c desc, email collate "C"), '[]'::jsonb) as data
    from (
      select email, count(*)::int as c
      from (
        select coalesce(substring(sender from '<([^>]+)>'), nullif(sender, '')) as email
        from e
      ) s
      where email is not null and email <> ''
      group by email
      order by c desc, email collate "C"
      limit 10
    ) z
  ),

  -- ===================== TOP CATEGORIES (par nom, fallback 'Autre') =====================
  top_categories as (
    select coalesce(jsonb_agg(jsonb_build_object('name', name, 'count', c) order by c desc, name collate "C"), '[]'::jsonb) as data
    from (
      select coalesce(cat.name, 'Autre') as name, count(*)::int as c
      from e left join categories cat on cat.id = e.category_id
      where e.category_id is not null
      group by coalesce(cat.name, 'Autre')
      order by c desc, name collate "C"
      limit 10
    ) z
  ),

  -- ===================== EVOLUTION (par jour, série complète) =====================
  ev_created as (
    select (created_at at time zone 'utc')::date as d, count(*)::int as c
    from e where created_at is not null group by 1
  ),
  ev_handled as (
    select (handled_ts at time zone 'utc')::date as d, count(*)::int as c
    from e where handled_ts is not null group by 1
  ),
  evolution as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'date', to_char(g.gd, 'YYYY-MM-DD'),
      'count', coalesce(c.c, 0),
      'handledCount', case when p_handled_enabled then coalesce(h.c, 0) else 0 end
    ) order by g.gd), '[]'::jsonb) as data
    from generate_series(v_today - (p_days - 1), v_today, interval '1 day') g(gd)
    left join ev_created c on c.d = g.gd::date
    left join ev_handled h on h.d = g.gd::date
  ),

  -- ===================== TÂCHES =====================
  tasks_scoped as (
    select distinct on (t.id) t.id, t.user_id, t.assigned_to_user_id, t.project_id, t.done, t.due_date
    from tasks t
    where t.user_id = any(p_member_ids) or t.assigned_to_user_id = any(p_member_ids)
  ),
  tpm as (
    select owner as uid,
      count(*) filter (where not done)::int as open,
      count(*) filter (where done)::int as done,
      count(*) filter (where not done and due_date is not null and due_date::date < v_today)::int as overdue
    from (select coalesce(assigned_to_user_id, user_id) as owner, done, due_date from tasks_scoped) q
    where owner = any(p_member_ids)
    group by owner
  ),
  tasks_per_member as (
    select coalesce(jsonb_agg(z.row order by z.sortkey desc, z.ord) filter (where z.keep), '[]'::jsonb) as data
    from (
      select
        m.uid,
        m.ord,
        (coalesce(t.open, 0) + coalesce(t.done, 0)) as sortkey,
        ((coalesce(t.open, 0) + coalesce(t.done, 0) + coalesce(t.overdue, 0)) > 0
          or p_member is null or m.uid = p_member) as keep,
        jsonb_build_object(
          'userId', m.uid,
          'open', coalesce(t.open, 0),
          'done', coalesce(t.done, 0),
          'overdue', coalesce(t.overdue, 0)
        ) as row
      from members m left join tpm t on t.uid = m.uid
    ) z
  ),
  -- tasksPerProject : "done" = 0 (parité avec le handler Node qui ne sélectionne
  -- pas updated_at -> sa condition done est toujours fausse). Tri : hors-projet en
  -- dernier, sinon open desc.
  tpp as (
    select project_id as pid,
      count(*) filter (where not done)::int as open,
      0 as done,
      count(*) filter (where not done and due_date is not null and due_date::date < v_today)::int as overdue
    from tasks_scoped
    group by project_id
  ),
  tasks_per_project as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'projectId', pid,
      'open', open,
      'done', done,
      'overdue', overdue,
      'isOutOfProject', pid is null
    ) order by (pid is null), open desc, pid), '[]'::jsonb) as data
    from tpp
  )

  select jsonb_build_object(
    'totals', (select to_jsonb(t) from totals t),
    'perMember', (select data from per_member),
    'perMailbox', (select data from per_mailbox),
    'perPersonal', (select data from per_personal),
    'perProject', (select data from per_project),
    'topSenders', (select data from top_senders),
    'topCategories', (select data from top_categories),
    'evolution', (select data from evolution),
    'tasksPerMember', (select data from tasks_per_member),
    'tasksPerProject', (select data from tasks_per_project)
  ) into result;

  return result;
end;
$$;
