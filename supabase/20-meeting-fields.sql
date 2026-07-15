-- Client meetings: capture the call time + who was on the invite.
alter table client_meetings add column if not exists meeting_time text;
alter table client_meetings add column if not exists participants text;
