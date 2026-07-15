-- Track who declined each call (from calendar responseStatus).
alter table client_meetings add column if not exists declines text;
