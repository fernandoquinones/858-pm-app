-- 09-library-structure.sql — new task model: type label + structured timing + recurrence
-- Run once in the Supabase SQL Editor. Safe to re-run (IF NOT EXISTS).
-- NOTE: pre/intra/post-event phase is NOT stored — the app derives it from the due date.

-- Library template columns
alter table library_tasks add column if not exists task_type    text;
alter table library_tasks add column if not exists due_amount   int;
alter table library_tasks add column if not exists due_unit     text;   -- days / weeks / months
alter table library_tasks add column if not exists due_ref      text;   -- before event / after event / on event date / varies
alter table library_tasks add column if not exists start_amount int;
alter table library_tasks add column if not exists start_unit   text;
alter table library_tasks add column if not exists start_ref    text;   -- before event / after event
alter table library_tasks add column if not exists recurrence   text;   -- none / weekly / twice weekly / biweekly / monthly

-- Per-event task columns (edited per event; never written back to the library)
alter table tasks add column if not exists task_type  text;
alter table tasks add column if not exists start_date date;
alter table tasks add column if not exists recurrence text;
-- tasks.due_date already exists and stays the per-event (editable) date
