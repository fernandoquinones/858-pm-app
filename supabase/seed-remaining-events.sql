-- Seed the 4 remaining events (not FSTEC) + their scan setup. Idempotent: creates the
-- event only if it doesn't already exist; won't overwrite an event_date you've already set.
-- VERIFY the "match" strings equal your actual booking-link titles, then hit Scan now.
do $$
declare pid uuid;
begin
  -- helper pattern repeated per event
  -- 1) Atlanta Nest Chapter Gathering (event ~10/15/26)
  select id into pid from projects where name = 'Atlanta Nest Chapter Gathering';
  if pid is null then insert into projects (name, type, event_date) values ('Atlanta Nest Chapter Gathering', 'Summit', '2026-10-15') returning id into pid;
  else update projects set event_date = coalesce(event_date, '2026-10-15') where id = pid; end if;
  delete from scan_meeting_types where project_id = pid;
  insert into scan_meeting_types (project_id, type, label, host, calendar, match, color, sort_order) values
    (pid, 'prep',    'Prep Call',           'Beth', 'beth@858partners.com', 'Atlanta Nest Kickoff',    '#0F6E56', 0),
    (pid, 'deal',    'Deal Strategy Call',  'JG',   'jg@858partners.com',   '858: Deal Strategy Call', '#185FA5', 1),
    (pid, 'debrief', 'Client Debrief Call', 'Beth', 'beth@858partners.com', 'Atlanta Nest Debrief',    '#8E44AD', 2);

  -- 2) CFO Summit @ RFDC (event ~11/8/26)
  select id into pid from projects where name = 'CFO Summit @ RFDC';
  if pid is null then insert into projects (name, type, event_date) values ('CFO Summit @ RFDC', 'Summit', '2026-11-08') returning id into pid;
  else update projects set event_date = coalesce(event_date, '2026-11-08') where id = pid; end if;
  delete from scan_meeting_types where project_id = pid;
  insert into scan_meeting_types (project_id, type, label, host, calendar, match, color, sort_order) values
    (pid, 'prep',    'Prep Call',           'Beth', 'beth@858partners.com', 'CFO Summit Kickoff',      '#0F6E56', 0),
    (pid, 'deal',    'Deal Strategy Call',  'JG',   'jg@858partners.com',   '858: Deal Strategy Call', '#185FA5', 1),
    (pid, 'debrief', 'Client Debrief Call', 'Beth', 'beth@858partners.com', 'CFO Summit Debrief',      '#8E44AD', 2);

  -- 3) Mumbo Summit @ RFDC (event ~11/9/26)
  select id into pid from projects where name = 'Mumbo Summit @ RFDC';
  if pid is null then insert into projects (name, type, event_date) values ('Mumbo Summit @ RFDC', 'Luncheon', '2026-11-09') returning id into pid;
  else update projects set event_date = coalesce(event_date, '2026-11-09') where id = pid; end if;
  delete from scan_meeting_types where project_id = pid;
  insert into scan_meeting_types (project_id, type, label, host, calendar, match, color, sort_order) values
    (pid, 'prep',    'Prep Call',           'Beth', 'beth@858partners.com', 'Mumbo Summit Kickoff',    '#0F6E56', 0),
    (pid, 'deal',    'Deal Strategy Call',  'JG',   'jg@858partners.com',   '858: Deal Strategy Call', '#185FA5', 1),
    (pid, 'debrief', 'Client Debrief Call', 'Beth', 'beth@858partners.com', 'Mumbo Summit Debrief',    '#8E44AD', 2);

  -- 4) So Cal Field Trip + Holiday Social (event ~12/3/26)
  select id into pid from projects where name = 'So Cal Field Trip + Holiday Social';
  if pid is null then insert into projects (name, type, event_date) values ('So Cal Field Trip + Holiday Social', 'Event', '2026-12-03') returning id into pid;
  else update projects set event_date = coalesce(event_date, '2026-12-03') where id = pid; end if;
  delete from scan_meeting_types where project_id = pid;
  insert into scan_meeting_types (project_id, type, label, host, calendar, match, color, sort_order) values
    (pid, 'prep',    'Prep Call',           'Beth', 'beth@858partners.com', 'So Cal Kickoff',          '#0F6E56', 0),
    (pid, 'deal',    'Deal Strategy Call',  'JG',   'jg@858partners.com',   '858: Deal Strategy Call', '#185FA5', 1),
    (pid, 'debrief', 'Client Debrief Call', 'Beth', 'beth@858partners.com', 'So Cal Debrief',          '#8E44AD', 2);
end $$;
