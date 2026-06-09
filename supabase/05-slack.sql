-- Run AFTER the earlier SQL files.
-- Maps a posted Slack message back to a task, so a reaction/reply on it knows what to update.
create table if not exists slack_links (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  channel text,
  ts text,                       -- Slack message timestamp
  created_at timestamptz default now(),
  unique (channel, ts)
);
alter table slack_links disable row level security;   -- prototype only
