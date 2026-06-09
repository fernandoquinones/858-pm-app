-- Run AFTER schema.sql and seed.sql.
-- Comments (in-app + from Slack). Slack-sourced comments show a badge in the UI.
create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  task_id uuid references tasks(id) on delete cascade,
  author text,
  body text not null,
  source text default 'app',          -- 'app' | 'slack'
  created_at timestamptz default now()
);
alter table comments disable row level security;   -- prototype only

-- Optional: a members table for production auth/roles (the app uses lib/roles.js for the prototype).
create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  name text,
  role text default 'member'          -- 'master' | 'member'
);
