-- Waitlist signups table — collects email addresses while paid plans are frozen.
-- Apply via Supabase SQL editor.

create table if not exists public.waitlist_signups (
  id          uuid        primary key default gen_random_uuid(),
  email       text        not null,
  plan        text        null,
  seats       integer     null,
  locale      text        null,
  source      text        null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint waitlist_signups_email_unique unique (email),
  constraint waitlist_signups_plan_chk    check (plan is null or plan in ('solo','pro','business')),
  constraint waitlist_signups_seats_chk   check (seats is null or (seats >= 1 and seats <= 500)),
  constraint waitlist_signups_source_chk  check (source is null or length(source) <= 64)
);

-- Add source column when migrating an existing table that predates it.
alter table public.waitlist_signups add column if not exists source text null;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'waitlist_signups_source_chk'
  ) then
    alter table public.waitlist_signups
      add constraint waitlist_signups_source_chk
      check (source is null or length(source) <= 64);
  end if;
end$$;

create index if not exists waitlist_signups_created_at_idx
  on public.waitlist_signups (created_at desc);

-- Service role only; no RLS policies needed because the API server uses the secret key.
alter table public.waitlist_signups enable row level security;
