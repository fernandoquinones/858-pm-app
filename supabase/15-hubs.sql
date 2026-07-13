-- Client Hub tables (per-client to-do checklists + sheet links). Team-only RLS.
create table if not exists event_clients (
  id uuid primary key default gen_random_uuid(),
  project_id uuid,
  name text,
  sheet_url text,
  sort_order int default 0,
  created_at timestamptz default now()
);
create table if not exists client_todos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid,
  client_id uuid,
  label text,
  done boolean default false,
  sort_order int default 0,
  created_at timestamptz default now()
);
do $$
declare t text;
begin
  foreach t in array array['event_clients','client_todos'] loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists team_read on %I;', t);
    execute format('drop policy if exists team_write on %I;', t);
    execute format('create policy team_read on %I for select using (is_team());', t);
    execute format('create policy team_write on %I for all using (is_team()) with check (is_team());', t);
  end loop;
end $$;
