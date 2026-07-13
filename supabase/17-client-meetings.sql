-- Client Hub: meeting-booking matrix + scanner findings.

-- primary contact on the client (no new table)
alter table event_clients add column if not exists contact_name  text;
alter table event_clients add column if not exists contact_email text;

-- one row per client × meeting type
create table if not exists client_meetings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid,
  client_id uuid,
  type text,                       -- 'prep' | 'deal' | 'debrief'
  status text default 'Not Booked',-- 'Not Booked' | 'Booked' | 'Completed' | 'N/A'
  meeting_date date,
  event_title text,                -- the actual calendar event title (for anomaly display)
  calendar_id text,                -- which calendar it was found on
  gcal_event_id text,              -- source event id (dedupe / link back)
  notes text,
  source text default 'manual',    -- 'manual' | 'scan'
  sort_order int default 0,
  updated_at timestamptz default now(),
  created_at timestamptz default now(),
  unique (client_id, type)
);

-- scanner anomaly findings
create table if not exists scan_flags (
  id uuid primary key default gen_random_uuid(),
  project_id uuid,
  level text default 'Low',        -- 'High' | 'Medium' | 'Low'
  text text,
  client_id uuid,                  -- optional link to a client
  resolved boolean default false,
  source text default 'scan',
  scanned_at timestamptz default now(),
  created_at timestamptz default now()
);

-- RLS: team-only (same pattern as 13-rls.sql)
alter table client_meetings enable row level security;
alter table scan_flags      enable row level security;
drop policy if exists team_read  on client_meetings;
drop policy if exists team_write on client_meetings;
drop policy if exists team_read  on scan_flags;
drop policy if exists team_write on scan_flags;
create policy team_read  on client_meetings for select using (is_team());
create policy team_write on client_meetings for all    using (is_team()) with check (is_team());
create policy team_read  on scan_flags      for select using (is_team());
create policy team_write on scan_flags      for all    using (is_team()) with check (is_team());
