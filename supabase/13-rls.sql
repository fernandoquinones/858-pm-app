-- ============================================================
-- Phase A — Row Level Security. Run this LAST, after sign-in is
-- confirmed working AND the service-role key is set in Vercel.
-- Rule: only a signed-in user whose email is in `profiles` (the team)
-- can read or write. Everyone else (anon / non-team) gets nothing.
-- Server routes use the service-role key and bypass this.
-- ============================================================

-- Is the current caller a provisioned team member?
create or replace function is_team() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p
    where lower(p.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'projects','workstreams','tasks','comments','attachments',
    'guests','seating_tables','library_tasks','slack_users','slack_links','profiles'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table %I enable row level security;', t);
      execute format('drop policy if exists team_read on %I;', t);
      execute format('drop policy if exists team_write on %I;', t);
      execute format('create policy team_read on %I for select using (is_team());', t);
      execute format('create policy team_write on %I for all using (is_team()) with check (is_team());', t);
    end if;
  end loop;
end $$;

-- ============================================================
-- ADDING A NEW TABLE LATER? Protect it the same way — either add its
-- name to the array above and re-run this file, or run these 2 lines:
--
--   alter table your_new_table enable row level security;
--   create policy team_read  on your_new_table for select using (is_team());
--   create policy team_write on your_new_table for all    using (is_team()) with check (is_team());
--
-- New COLUMNS on existing tables need nothing (RLS is per-table).
-- ============================================================
