-- Per-event, per-meeting-type header card: editable description + slot window.
create table if not exists meeting_meta (
  id uuid primary key default gen_random_uuid(),
  project_id uuid,
  type text,               -- prep | deal | debrief
  description text,
  slot_window text,
  unique (project_id, type)
);
alter table meeting_meta enable row level security;
drop policy if exists team_read on meeting_meta;
drop policy if exists team_write on meeting_meta;
create policy team_read on meeting_meta for select using (is_team());
create policy team_write on meeting_meta for all using (is_team()) with check (is_team());
