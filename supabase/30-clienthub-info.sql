-- Client Hub: richer attendee details + client-facing event info + agenda blocks.
alter table client_attendees add column if not exists phone text;
alter table projects add column if not exists client_info text;   -- client-facing note (arrival, what to know)
create table if not exists event_agenda (
  id uuid primary key default gen_random_uuid(),
  project_id uuid, time text, block text, sort_order int default 0, created_at timestamptz default now()
);
alter table event_agenda enable row level security;
drop policy if exists team_read on event_agenda;
drop policy if exists team_write on event_agenda;
create policy team_read on event_agenda for select using (is_team());
create policy team_write on event_agenda for all using (is_team()) with check (is_team());
