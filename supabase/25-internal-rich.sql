-- Richer Internal Hub: narrative sections + per-item flags + day footnotes.
create table if not exists internal_blocks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid,
  section text,            -- 'meta' | 'flags' | 'keynotes' | 'roles' | 'vip_strategy'
  label text,              -- roles: person; otherwise null
  value text,
  sort_order int default 0,
  created_at timestamptz default now()
);
alter table ros_days  add column if not exists footnote text;
alter table ros_items add column if not exists flag boolean default false;
alter table internal_blocks enable row level security;
drop policy if exists team_read on internal_blocks;
drop policy if exists team_write on internal_blocks;
create policy team_read on internal_blocks for select using (is_team());
create policy team_write on internal_blocks for all using (is_team()) with check (is_team());
