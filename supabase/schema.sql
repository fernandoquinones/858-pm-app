-- 858 Project Tool — schema
-- Run this first in Supabase → SQL Editor → New query → Run.

create extension if not exists pgcrypto;

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text,
  event_date date,
  created_at timestamptz default now()
);

create table if not exists workstreams (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  name text not null,
  timing text,
  sort_order int default 0
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  workstream_id uuid references workstreams(id) on delete set null,
  title text not null,
  owner text,
  applies_to text,
  status text default 'todo',          -- todo | prog | review | done
  due_date date,
  notes text,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists seating_tables (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  name text not null,
  capacity int default 4,
  is_host boolean default false,
  sort_order int default 0
);

create table if not exists guests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  name text not null,
  company text,
  tier int,                            -- 1, 2, or null
  status text default 'confirmed',     -- confirmed | noshow | waitlist
  table_id uuid references seating_tables(id) on delete set null,
  sort_order int default 0
);

create table if not exists activity (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  actor text,
  action text,
  detail text,
  created_at timestamptz default now()
);

-- keep tasks.updated_at fresh
create or replace function touch_updated() returns trigger as $$
begin new.updated_at = now(); return new; end; $$ language plpgsql;
drop trigger if exists tasks_touch on tasks;
create trigger tasks_touch before update on tasks
  for each row execute function touch_updated();

-- PROTOTYPE access: RLS off so the anon key can read/write.
-- Turn RLS on and add policies before sharing outside the team.
alter table projects        disable row level security;
alter table workstreams     disable row level security;
alter table tasks           disable row level security;
alter table seating_tables  disable row level security;
alter table guests          disable row level security;
alter table activity        disable row level security;
