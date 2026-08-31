-- Client's company email domain — the reliable scan-match signal (e.g. toasttab.com).
alter table event_clients add column if not exists company_domain text;
