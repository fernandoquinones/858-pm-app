-- Client Hub v2: per-client attendees + outstanding follow-ups.

create table if not exists client_attendees (
  id uuid primary key default gen_random_uuid(),
  project_id uuid,
  client_id uuid,
  name text,
  email text,
  title text,
  sort_order int default 0,
  created_at timestamptz default now()
);

create table if not exists client_outstanding (
  id uuid primary key default gen_random_uuid(),
  project_id uuid,
  client_id uuid,
  item text,
  done boolean default false,
  sort_order int default 0,
  created_at timestamptz default now()
);

alter table client_attendees   enable row level security;
alter table client_outstanding enable row level security;
drop policy if exists team_read  on client_attendees;
drop policy if exists team_write on client_attendees;
drop policy if exists team_read  on client_outstanding;
drop policy if exists team_write on client_outstanding;
create policy team_read  on client_attendees   for select using (is_team());
create policy team_write on client_attendees   for all    using (is_team()) with check (is_team());
create policy team_read  on client_outstanding for select using (is_team());
create policy team_write on client_outstanding for all    using (is_team()) with check (is_team());
