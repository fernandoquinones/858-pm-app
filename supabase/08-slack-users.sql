-- Run once. Maps each person's app name to their Slack member ID so the bot can @-mention them.
create table if not exists slack_users (
  name text primary key,     -- exactly as shown in the app: Christina, Fernando, Nic, JG, Chris, Marty
  slack_id text              -- their Slack member ID (looks like U0XXXXXXX)
);
alter table slack_users disable row level security;
-- Then add a row per person (Supabase → Table Editor → slack_users → Insert):
--   name = Christina, slack_id = U0XXXX...   (etc.)
