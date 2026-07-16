-- Internal Hub: onsite team (hotels/flights) + run of show.
create table if not exists onsite_team (
  id uuid primary key default gen_random_uuid(),
  project_id uuid, name text, role text, emoji text, email text,
  hotel text, confirmation_number text, check_in text, check_out text,
  flight_in_date text, flight_in_time text, flight_in_from text,
  flight_out_date text, flight_out_time text, flight_out_to text,
  notes text, sort_order int default 0, created_at timestamptz default now()
);
create table if not exists ros_days (
  id uuid primary key default gen_random_uuid(),
  project_id uuid, label text, day_date text, color text, sort_order int default 0, created_at timestamptz default now()
);
create table if not exists ros_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid, day_id uuid, time text, duration text, title text, notes text, sort_order int default 0, created_at timestamptz default now()
);
create table if not exists ros_notes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid, label text, note text, sort_order int default 0, created_at timestamptz default now()
);
do $$ declare t text; begin
  foreach t in array array['onsite_team','ros_days','ros_items','ros_notes'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists team_read on %I', t);
    execute format('drop policy if exists team_write on %I', t);
    execute format('create policy team_read on %I for select using (is_team())', t);
    execute format('create policy team_write on %I for all using (is_team()) with check (is_team())', t);
  end loop;
end $$;
