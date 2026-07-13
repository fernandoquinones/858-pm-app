-- Phase A logins: maps a signed-in email -> person + role.
create table if not exists profiles (
  email text primary key,
  name  text,
  role  text default 'user'
);

insert into profiles (email, name, role) values
  ('fernando@858partners.com',          'Fernando',  'owner'),
  ('christina.auyeung@858partners.com', 'Christina', 'admin'),
  ('jg@858partners.com',                'JG',        'user'),
  ('nic@858partners.com',               'Nic',       'user'),
  ('caitlin@858partners.com',           'Caitlin',   'user'),
  ('beth@858partners.com',              'Beth',      'user'),
  ('marty@858partners.com',             'Marty',     'user'),
  ('nola@858partners.com',              'Nola',      'user')
on conflict (email) do update set name = excluded.name, role = excluded.role;
