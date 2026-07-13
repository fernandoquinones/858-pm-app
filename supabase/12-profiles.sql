-- Phase A logins: maps a signed-in email -> person + role.
create table if not exists profiles (
  email text primary key,
  name  text,
  role  text default 'member'
);

-- Fill in each teammate's real login email. Names must match the app's people.
insert into profiles (email, name, role) values
  ('fernando@858partners.com', 'Fernando',  'master'),
  ('CHRISTINA_EMAIL',          'Christina', 'master'),
  ('JG_EMAIL',                 'JG',        'member'),
  ('NIC_EMAIL',                'Nic',       'member'),
  ('CAITLIN_EMAIL',            'Caitlin',   'member'),
  ('BETH_EMAIL',               'Beth',      'member'),
  ('MARTY_EMAIL',              'Marty',     'member')
on conflict (email) do update set name = excluded.name, role = excluded.role;
