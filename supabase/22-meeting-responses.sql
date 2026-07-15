-- Per-meeting response states from the calendar (besides declines).
alter table client_meetings add column if not exists tentative text;   -- "maybe"
alter table client_meetings add column if not exists no_response text;  -- needsAction
