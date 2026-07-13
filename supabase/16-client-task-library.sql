-- Editable standard client-task library (seeds every new client's checklist).
create table if not exists client_task_library (
  id uuid primary key default gen_random_uuid(),
  label text unique,
  sort_order int default 0,
  created_at timestamptz default now()
);
insert into client_task_library (label, sort_order) values
  ('Send top 20 target list', 0),
  ('Complete dossier prioritization (Tier 1/2, customers, detractors)', 1),
  ('Complete GRIP operator selections (top 40)', 2),
  ('Confirm GRIP designate', 3),
  ('Register attendees for the event', 4),
  ('Book hotels', 5),
  ('Confirm VIP dinner attendees', 6),
  ('Submit marketing collateral to Informa', 7),
  ('Submit tech-stand requirements', 8),
  ('Schedule prep call', 9),
  ('Schedule deal strategy call', 10),
  ('Schedule debrief call', 11)
on conflict (label) do nothing;

alter table client_task_library enable row level security;
drop policy if exists team_read on client_task_library;
drop policy if exists team_write on client_task_library;
create policy team_read on client_task_library for select using (is_team());
create policy team_write on client_task_library for all using (is_team()) with check (is_team());
