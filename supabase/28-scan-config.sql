-- Per-event scan setup: which calendars + title patterns define each meeting type.
-- An event is scanned iff it has rows here. Makes the scanner work for ANY event.
create table if not exists scan_meeting_types (
  id uuid primary key default gen_random_uuid(),
  project_id uuid,
  type text,            -- 'prep' | 'deal' | 'debrief' (or custom)
  label text,           -- 'Prep Call'
  host text,            -- 'Beth'
  calendar text,        -- 'beth@858partners.com'
  match text,           -- title contains, e.g. 'CREATE Kickoff'
  color text default '#5F6368',
  sort_order int default 0,
  created_at timestamptz default now()
);
alter table scan_meeting_types enable row level security;
drop policy if exists team_read on scan_meeting_types;
drop policy if exists team_write on scan_meeting_types;
create policy team_read on scan_meeting_types for select using (is_team());
create policy team_write on scan_meeting_types for all using (is_team()) with check (is_team());
