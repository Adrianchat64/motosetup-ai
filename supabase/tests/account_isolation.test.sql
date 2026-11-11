begin;
create extension if not exists pgtap with schema extensions;
select extensions.plan(11);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'moto-test-a@example.invalid', 'test-only', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Rider A","plan":"premium"}', now(), now()),
  ('20000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'moto-test-b@example.invalid', 'test-only', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Rider B"}', now(), now());

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);
insert into public.rider_profiles (user_id, client_id, name)
values ('20000000-0000-4000-8000-000000000002', 'test-rider-b', 'Rider B');
insert into public.bikes (user_id, client_id, make, model, model_year, engine_type)
values ('20000000-0000-4000-8000-000000000002', 'test-bike-b', 'Honda', 'CRF250R', 2025, '4-stroke');

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
insert into public.rider_profiles (user_id, client_id, name)
values ('10000000-0000-4000-8000-000000000001', 'test-rider-a', 'Rider A');
insert into public.bikes (user_id, client_id, make, model, model_year, engine_type)
values ('10000000-0000-4000-8000-000000000001', 'test-bike-a', 'Yamaha', 'YZ125', 2025, '2-stroke');

select extensions.is(
  (select count(*)::integer from public.rider_profiles), 1,
  'A user can read their own rider profile'
);
select extensions.is(
  (select count(*)::integer from public.rider_profiles where name = 'Rider B'), 0,
  'A user cannot read another account rider profile'
);
select extensions.is(
  (select count(*)::integer from public.bikes), 1,
  'A user can read their own bike'
);
select extensions.is(
  (select count(*)::integer from public.bikes where model = 'CRF250R'), 0,
  'A user cannot read another account bike'
);
select extensions.is(
  (select plan from public.accounts where id = '10000000-0000-4000-8000-000000000001'),
  'free', 'Signup metadata cannot grant Premium'
);
select extensions.lives_ok(
  $$insert into public.rider_profiles (user_id, client_id, name)
    values ('10000000-0000-4000-8000-000000000001', 'test-rider-a', 'Rider A Updated')
    on conflict (user_id, client_id) do update set name = excluded.name$$,
  'A Free user can update their existing rider profile'
);
select extensions.throws_ok(
  $$insert into public.rider_profiles (user_id, client_id, name)
    values ('10000000-0000-4000-8000-000000000001', 'test-rider-a-2', 'Second Free Rider')$$,
  '23514', 'free_plan_rider_limit',
  'The database rejects a second Free rider profile'
);
select extensions.throws_ok(
  $$update public.accounts set plan = 'premium'
    where id = '10000000-0000-4000-8000-000000000001'$$,
  '42501', null,
  'A browser client cannot change its subscription plan'
);
select extensions.throws_ok(
  $$insert into public.bikes (user_id, client_id, make, model, engine_type)
    values ('20000000-0000-4000-8000-000000000002', 'spoof-bike', 'KTM', '125 SX', '2-stroke')$$,
  '42501', null,
  'A user cannot write a bike into another account'
);

reset role;
update public.accounts set plan = 'premium'
where id = '10000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select extensions.lives_ok(
  $$insert into public.rider_profiles (user_id, client_id, name)
    values ('10000000-0000-4000-8000-000000000001', 'test-rider-a-2', 'Second Premium Rider')$$,
  'Premium accounts can save additional rider profiles'
);
select extensions.is(
  (select plan from public.accounts where id = '10000000-0000-4000-8000-000000000001'),
  'premium', 'The account can read its server-owned entitlement'
);

select * from extensions.finish();
rollback;
