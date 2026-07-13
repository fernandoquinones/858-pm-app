-- CREATE 2026 seed — clients, meetings, attendees, outstanding, scan flags.
-- Built from the live calendar scan on 2026-07-13. Idempotent: skips if the event exists.
do $$
declare pid uuid; cid uuid;
begin
  select id into pid from projects where name = '858 × CREATE 2026';
  if pid is not null then raise notice 'CREATE 2026 already exists (%). Skipping.', pid; return; end if;
  insert into projects (name, type, event_date) values ('858 × CREATE 2026', 'Summit', '2026-07-20') returning id into pid;

  -- Momos
  insert into event_clients (project_id, name, contact_name, contact_email, sort_order) values (pid, 'Momos', 'Katherine Koski', 'katherine.koski@momos.com', 0) returning id into cid;
  insert into client_todos (project_id, client_id, label, sort_order) select pid, cid, label, sort_order from client_task_library;
  insert into client_meetings (project_id, client_id, type, status, meeting_date, event_title, source, sort_order) values
    (pid, cid, 'prep', 'Booked', '2026-07-09'::date, 'CREATE Kickoff (Katherine Koski)', 'scan', 0),
    (pid, cid, 'deal', 'Booked', '2026-07-14'::date, '858: Deal Strategy Call (Katherine Koski)', 'scan', 1),
    (pid, cid, 'debrief', 'Booked', '2026-07-28'::date, 'CREATE Debrief (Katherine Koski)', 'scan', 2);

  -- Toast
  insert into event_clients (project_id, name, contact_name, contact_email, sort_order) values (pid, 'Toast', 'Amy Schliestett', 'amy.schliestett@toasttab.com', 1) returning id into cid;
  insert into client_todos (project_id, client_id, label, sort_order) select pid, cid, label, sort_order from client_task_library;
  insert into client_meetings (project_id, client_id, type, status, meeting_date, event_title, source, sort_order) values
    (pid, cid, 'prep', 'Booked', '2026-07-08'::date, 'CREATE Kickoff (Toast Team Schliestett)', 'scan', 0),
    (pid, cid, 'deal', 'Booked', '2026-07-14'::date, '858: Deal Strategy Call (Toast  Schliestett)', 'scan', 1),
    (pid, cid, 'debrief', 'Booked', '2026-07-27'::date, '858 + Toast - CREATE debrief', 'scan', 2);
  insert into client_outstanding (project_id, client_id, item, sort_order) values
    (pid, cid, 'Confirm who owns 1:1 follow-up — debrief attended by Morgan McMains, not original contact Amy Schliestett', 0);

  -- WithCoverage
  insert into event_clients (project_id, name, contact_name, contact_email, sort_order) values (pid, 'WithCoverage', 'Sage Disch', 'sage@withcoverage.com', 2) returning id into cid;
  insert into client_todos (project_id, client_id, label, sort_order) select pid, cid, label, sort_order from client_task_library;
  insert into client_meetings (project_id, client_id, type, status, meeting_date, event_title, source, sort_order) values
    (pid, cid, 'prep', 'Booked', '2026-07-06'::date, 'CREATE Kickoff (Sage Disch)', 'scan', 0),
    (pid, cid, 'deal', 'Booked', '2026-07-13'::date, '858: Deal Strategy Call (Sage Disch)', 'scan', 1),
    (pid, cid, 'debrief', 'Not Booked', null::date, null, 'scan', 2);
  insert into client_attendees (project_id, client_id, name, email, title, sort_order) values
    (pid, cid, 'Sage Disch', 'sage@withcoverage.com', null, 0),
    (pid, cid, 'Zach Zimmerman', null, null, 1);
  insert into client_outstanding (project_id, client_id, item, sort_order) values
    (pid, cid, 'Debrief not booked — reach out to Sage Disch', 0);

  -- Buyers Edge
  insert into event_clients (project_id, name, contact_name, contact_email, sort_order) values (pid, 'Buyers Edge', 'Ciara Medina', 'ciara.medina@buyersedgeplatform.com', 3) returning id into cid;
  insert into client_todos (project_id, client_id, label, sort_order) select pid, cid, label, sort_order from client_task_library;
  insert into client_meetings (project_id, client_id, type, status, meeting_date, event_title, source, sort_order) values
    (pid, cid, 'prep', 'Booked', '2026-07-08'::date, 'CREATE Kickoff (Ciara Medina)', 'scan', 0),
    (pid, cid, 'deal', 'Booked', '2026-07-15'::date, '858: Deal Strategy Call (Ciara Medina)', 'scan', 1),
    (pid, cid, 'debrief', 'Booked', '2026-07-28'::date, 'CREATE Debrief (Ciara Medina)', 'scan', 2);
  insert into client_attendees (project_id, client_id, name, email, title, sort_order) values
    (pid, cid, 'Chris Anderson', 'chris.anderson@insidetrackdata.com', null, 0),
    (pid, cid, 'Shannon Brooks', 'shannon.brooks@consolidatedconcepts.net', null, 1);

  -- Axial Shift
  insert into event_clients (project_id, name, contact_name, contact_email, sort_order) values (pid, 'Axial Shift', 'Sarah Higgins', 'sarah@axialcommerce.com', 4) returning id into cid;
  insert into client_todos (project_id, client_id, label, sort_order) select pid, cid, label, sort_order from client_task_library;
  insert into client_meetings (project_id, client_id, type, status, meeting_date, event_title, source, sort_order) values
    (pid, cid, 'prep', 'Booked', '2026-07-06'::date, 'CREATE Kickoff (Sarah Higgins)', 'scan', 0),
    (pid, cid, 'deal', 'Booked', '2026-07-16'::date, '858: Deal Strategy Call (Sarah Higgins)', 'scan', 1),
    (pid, cid, 'debrief', 'Booked', '2026-07-28'::date, 'CREATE Debrief (Sarah Higgins)', 'scan', 2);
  insert into client_attendees (project_id, client_id, name, email, title, sort_order) values
    (pid, cid, 'Sarah Higgins', 'sarah@axialcommerce.com', null, 0),
    (pid, cid, 'Raechel Barnes', 'raechel.barnes@axialcommerce.com', null, 1);
  insert into client_outstanding (project_id, client_id, item, sort_order) values
    (pid, cid, 'Reconcile debrief date — roster says Jul 30, calendar says Jul 28', 0);

  -- Meez
  insert into event_clients (project_id, name, contact_name, contact_email, sort_order) values (pid, 'Meez', 'Liz Van Hoose', 'liz@getmeez.com', 5) returning id into cid;
  insert into client_todos (project_id, client_id, label, sort_order) select pid, cid, label, sort_order from client_task_library;
  insert into client_meetings (project_id, client_id, type, status, meeting_date, event_title, source, sort_order) values
    (pid, cid, 'prep', 'Booked', '2026-07-08'::date, 'CREATE Kickoff (Liz Van Hoose)', 'scan', 0),
    (pid, cid, 'deal', 'Booked', '2026-07-15'::date, '858: Deal Strategy Call (Liz Van Hoose)', 'scan', 1),
    (pid, cid, 'debrief', 'Booked', '2026-07-28'::date, 'CREATE Debrief (Liz Van Hoose)', 'scan', 2);
  insert into client_attendees (project_id, client_id, name, email, title, sort_order) values
    (pid, cid, 'Joshua Sharkey', null, 'CEO', 0),
    (pid, cid, 'Sebastian Stryker', null, 'CRO', 1),
    (pid, cid, 'Dominic Casaus', null, 'Senior Account Executive', 2);

  -- Reachify
  insert into event_clients (project_id, name, contact_name, contact_email, sort_order) values (pid, 'Reachify', 'Zeel Jadia', 'zjadia@reachify.io', 6) returning id into cid;
  insert into client_todos (project_id, client_id, label, sort_order) select pid, cid, label, sort_order from client_task_library;
  insert into client_meetings (project_id, client_id, type, status, meeting_date, event_title, source, sort_order) values
    (pid, cid, 'prep', 'Booked', '2026-07-08'::date, 'CREATE Kickoff (Zeel Jadia)', 'scan', 0),
    (pid, cid, 'deal', 'Booked', '2026-07-14'::date, '858: Deal Strategy Call (Zeel Jadia)', 'scan', 1),
    (pid, cid, 'debrief', 'Booked', '2026-07-27'::date, 'CREATE Debrief (Zeel Jadia)', 'scan', 2);
  insert into client_attendees (project_id, client_id, name, email, title, sort_order) values
    (pid, cid, 'Zeel Jadia', 'zjadia@reachify.io', null, 0);

  insert into scan_flags (project_id, level, text, source) values
    (pid, 'High', 'WithCoverage debrief still not booked — the only gap across all 21 tracked slots (7 clients × 3 meeting types).', 'scan'),
    (pid, 'Medium', 'Toast''s three calls use non-standard event names (Toast Team Schliestett / Toast  Schliestett / 858 + Toast - CREATE debrief) — a naive name search would miss them.', 'scan'),
    (pid, 'Low', 'Fernando declined the prep-call invites for Axial Shift, Buyers Edge, and Momos — confirm he''s getting recaps another way.', 'scan');
end $$;
