-- CREATE 2026 scan setup. Prep + Debrief now read Beth's calendar; Deal reads JG's.
do $$ declare pid uuid; begin
  select id into pid from projects where name = 'CREATE 2026';
  if pid is null then raise notice 'CREATE 2026 not found'; return; end if;
  delete from scan_meeting_types where project_id = pid;
  insert into scan_meeting_types (project_id, type, label, host, calendar, match, color, sort_order) values
    (pid, 'prep',    'Prep Call',          'Beth', 'beth@858partners.com', 'CREATE Kickoff',           '#0F6E56', 0),
    (pid, 'deal',    'Deal Strategy Call', 'JG',   'jg@858partners.com',   '858: Deal Strategy Call',  '#185FA5', 1),
    (pid, 'debrief', 'Client Debrief Call','Beth', 'beth@858partners.com', 'CREATE Debrief',           '#8E44AD', 2);
end $$;
