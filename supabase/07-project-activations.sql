-- Run once in Supabase SQL Editor. Lets each event store the activations it includes.
alter table projects add column if not exists activations text;
