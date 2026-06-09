-- Run AFTER schema.sql. Each event/project gets its own Slack channel.
alter table projects add column if not exists slack_channel_id text;
alter table projects add column if not exists slack_channel_name text;
