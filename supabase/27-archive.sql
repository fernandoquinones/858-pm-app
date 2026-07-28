-- Events stay "current" until manually moved to past (no auto date rule).
alter table projects add column if not exists archived boolean default false;
