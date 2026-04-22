-- Add is_admin flag on profiles for the internal admin panel.
-- Apply via Supabase SQL editor.

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

create index if not exists profiles_is_admin_idx
  on public.profiles (is_admin)
  where is_admin = true;

-- Grant the flag to the founder. Safe to re-run: no-op if the email is unknown
-- because the join filters out missing rows.
update public.profiles p
set is_admin = true
from auth.users u
where u.id = p.id
  and lower(u.email) = 'jj.neybergh@gmail.com';
