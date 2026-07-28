-- Tag which teammate a DM slack_link belongs to (for per-owner comment notifications).
alter table slack_links add column if not exists slack_id text;
