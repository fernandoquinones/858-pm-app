-- Run AFTER schema.sql, seed.sql, 02-comments.sql.
-- Attachments: files (uploaded) and links (e.g. dossier URLs) pinned to a task.
create table if not exists attachments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  task_id uuid references tasks(id) on delete cascade,
  kind text default 'link',           -- 'file' | 'link'
  name text,
  url text not null,
  added_by text,
  created_at timestamptz default now()
);
alter table attachments disable row level security;   -- prototype only

-- STORAGE (one-time, in the Supabase dashboard):
--   Storage → New bucket → name it "attachments" → make it PUBLIC.
-- Uploaded files go there; the app saves their public URL in the table above.
