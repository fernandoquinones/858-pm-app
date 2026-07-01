-- Slack DM mapping: one row per teammate, name must match the OWNER names used in tasks.
create table if not exists slack_users (
  name      text primary key,
  slack_id  text
);

-- Fill in each person's Slack MEMBER ID (Slack profile ▸ ⋮ ▸ "Copy member ID", looks like U0XXXXXXX).
-- Leave slack_id null for anyone you don't want DMed yet.
insert into slack_users (name, slack_id) values
  ('Christina', null),
  ('Fernando',  null),
  ('JG',        null),
  ('Nic',       null),
  ('Chris',     null),
  ('Marty',     null)
on conflict (name) do nothing;

-- Example to set one later:
-- update slack_users set slack_id = 'U01ABC23DEF' where name = 'Christina';

-- slack_links (created earlier) maps a Slack message to a task; ensure it exists:
create table if not exists slack_links (
  channel    text,
  ts         text,
  task_id    uuid,
  project_id uuid,
  primary key (channel, ts)
);
