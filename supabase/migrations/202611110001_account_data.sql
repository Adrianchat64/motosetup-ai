-- MotoSetup AI account and garage foundation.
-- Safe to apply to an empty Supabase project; this migration does not drop data.

create table if not exists public.accounts (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  plan text not null default 'free' check (plan in ('free', 'premium')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rider_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.accounts(id) on delete cascade,
  client_id text not null,
  name text not null check (length(trim(name)) between 1 and 100),
  weight_gear_lb numeric(6,2) check (weight_gear_lb is null or weight_gear_lb between 1 and 1000),
  height text,
  experience_level text,
  riding_style text,
  preferences text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_id),
  unique (id, user_id)
);

create table if not exists public.bikes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.accounts(id) on delete cascade,
  client_id text not null,
  make text not null,
  model text not null,
  model_year integer check (model_year is null or model_year between 1950 and 2200),
  engine_type text not null check (engine_type in ('2-stroke', '4-stroke')),
  engine_hours numeric(8,1) not null default 0 check (engine_hours >= 0),
  modifications text,
  notes text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_id),
  unique (id, user_id)
);

create table if not exists public.suspension_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.accounts(id) on delete cascade,
  client_id text not null,
  bike_id uuid not null,
  rider_id uuid references public.rider_profiles(id) on delete set null,
  fork_compression_clicks integer,
  fork_rebound_clicks integer,
  shock_compression_clicks integer,
  shock_rebound_clicks integer,
  spring_rate_front numeric(7,3),
  spring_rate_rear numeric(7,3),
  static_sag_mm numeric(6,1),
  rider_sag_mm numeric(6,1),
  track_conditions text,
  riding_feedback text,
  result text,
  recommendation text,
  specification_source text,
  factory_spec_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_id),
  foreign key (bike_id, user_id) references public.bikes(id, user_id) on delete cascade
);

create table if not exists public.maintenance_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.accounts(id) on delete cascade,
  client_id text not null,
  bike_id uuid not null,
  service text not null check (length(trim(service)) between 1 and 120),
  engine_hours numeric(8,1) check (engine_hours is null or engine_hours >= 0),
  performed_on date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_id),
  foreign key (bike_id, user_id) references public.bikes(id, user_id) on delete cascade
);

create table if not exists public.maintenance_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.accounts(id) on delete cascade,
  client_id text not null,
  bike_id uuid not null,
  service text not null check (length(trim(service)) between 1 and 120),
  engine_type text check (engine_type is null or engine_type in ('2-stroke', '4-stroke')),
  interval_hours numeric(8,1) check (interval_hours is null or interval_hours > 0),
  interval_days integer check (interval_days is null or interval_days > 0),
  next_due_hours numeric(8,1) check (next_due_hours is null or next_due_hours >= 0),
  next_due_on date,
  is_custom boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_id),
  foreign key (bike_id, user_id) references public.bikes(id, user_id) on delete cascade,
  check (interval_hours is not null or interval_days is not null)
);

create table if not exists public.gearing_setups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.accounts(id) on delete cascade,
  client_id text not null,
  bike_id uuid not null,
  rider_id uuid references public.rider_profiles(id) on delete set null,
  track_conditions text,
  front_sprocket_teeth integer not null check (front_sprocket_teeth between 1 and 100),
  rear_sprocket_teeth integer not null check (rear_sprocket_teeth between 1 and 200),
  recommended_front_teeth integer check (recommended_front_teeth is null or recommended_front_teeth between 1 and 100),
  recommended_rear_teeth integer check (recommended_rear_teeth is null or recommended_rear_teeth between 1 and 200),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_id),
  foreign key (bike_id, user_id) references public.bikes(id, user_id) on delete cascade
);

create index if not exists rider_profiles_user_updated_idx on public.rider_profiles(user_id, updated_at desc);
create index if not exists bikes_user_updated_idx on public.bikes(user_id, updated_at desc);
create index if not exists suspension_settings_user_bike_idx on public.suspension_settings(user_id, bike_id, updated_at desc);
create index if not exists maintenance_records_user_bike_idx on public.maintenance_records(user_id, bike_id, performed_on desc);
create index if not exists maintenance_schedules_user_bike_idx on public.maintenance_schedules(user_id, bike_id);
create index if not exists gearing_setups_user_bike_idx on public.gearing_setups(user_id, bike_id, updated_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'accounts', 'rider_profiles', 'bikes', 'suspension_settings',
    'maintenance_records', 'maintenance_schedules', 'gearing_setups'
  ] loop
    execute format('drop trigger if exists set_updated_at on public.%I', target_table);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', target_table);
  end loop;
end;
$$;

-- Realtime is optional locally, but subscribe to owned rider/bike rows when the
-- standard Supabase publication exists. RLS still filters every delivered row.
do $$
declare
  target_table text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach target_table in array array['rider_profiles', 'bikes'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = target_table
      ) then
        execute format('alter publication supabase_realtime add table public.%I', target_table);
      end if;
    end loop;
  end if;
end;
$$;

create or replace function public.create_account_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.accounts (id, display_name, plan)
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    'free'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.create_account_for_auth_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created_motosetup on auth.users;
create trigger on_auth_user_created_motosetup
  after insert on auth.users
  for each row execute function public.create_account_for_auth_user();

-- Backfill accounts for Auth users that existed before this migration. The
-- conflict clause preserves any account rows (including their plan) already present.
insert into public.accounts (id, display_name, plan)
select
  u.id,
  nullif(trim(u.raw_user_meta_data ->> 'display_name'), ''),
  'free'
from auth.users as u
on conflict (id) do nothing;

create or replace function public.enforce_rider_profile_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_plan text;
  profile_count integer;
begin
  if auth.uid() is null or new.user_id is distinct from auth.uid() then
    raise exception using errcode = '42501', message = 'account_owner_mismatch';
  end if;

  if tg_op = 'UPDATE' then
    if old.deleted_at is null or new.deleted_at is not null then
      return new;
    end if;
  end if;

  -- Lock the account row so two concurrent inserts cannot both pass the Free limit.
  select a.plan into current_plan
  from public.accounts as a
  where a.id = new.user_id
  for update;

  if current_plan is null then
    raise exception using errcode = '23503', message = 'account_not_found';
  end if;

  -- INSERT ... ON CONFLICT invokes this trigger too. Allow updating the existing
  -- profile when a Free user already has their one permitted profile.
  if tg_op = 'INSERT' and exists (
    select 1 from public.rider_profiles r
    where r.user_id = new.user_id and r.client_id = new.client_id and r.deleted_at is null
  ) then
    return new;
  end if;

  if current_plan = 'free' then
    select count(*) into profile_count
    from public.rider_profiles as r
    where r.user_id = new.user_id
      and r.deleted_at is null
      and (tg_op = 'INSERT' or r.id <> new.id);

    if profile_count >= 1 then
      raise exception using errcode = '23514', message = 'free_plan_rider_limit';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_rider_profile_limit() from public, anon, authenticated;
drop trigger if exists enforce_rider_profile_limit on public.rider_profiles;
create trigger enforce_rider_profile_limit
  before insert or update on public.rider_profiles
  for each row execute function public.enforce_rider_profile_limit();

create or replace function public.enforce_rider_reference_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.rider_id is not null and not exists (
    select 1 from public.rider_profiles r
    where r.id = new.rider_id and r.user_id = new.user_id
  ) then
    raise exception using errcode = '23503', message = 'rider_not_owned_by_account';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_rider_reference_owner() from public, anon, authenticated;
drop trigger if exists suspension_rider_owner on public.suspension_settings;
create trigger suspension_rider_owner before insert or update on public.suspension_settings
  for each row execute function public.enforce_rider_reference_owner();
drop trigger if exists gearing_rider_owner on public.gearing_setups;
create trigger gearing_rider_owner before insert or update on public.gearing_setups
  for each row execute function public.enforce_rider_reference_owner();

alter table public.accounts enable row level security;
alter table public.rider_profiles enable row level security;
alter table public.bikes enable row level security;
alter table public.suspension_settings enable row level security;
alter table public.maintenance_records enable row level security;
alter table public.maintenance_schedules enable row level security;
alter table public.gearing_setups enable row level security;

revoke all on public.accounts, public.rider_profiles, public.bikes,
  public.suspension_settings, public.maintenance_records,
  public.maintenance_schedules, public.gearing_setups from anon, authenticated;

grant select on public.accounts to authenticated;
grant update (display_name) on public.accounts to authenticated;
grant select, insert, update on public.rider_profiles, public.bikes to authenticated;
grant select, insert, update, delete on public.suspension_settings,
  public.maintenance_records, public.maintenance_schedules,
  public.gearing_setups to authenticated;

drop policy if exists accounts_read_self on public.accounts;
create policy accounts_read_self on public.accounts for select to authenticated
  using ((select auth.uid()) = id);
drop policy if exists accounts_update_display_name on public.accounts;
create policy accounts_update_display_name on public.accounts for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'rider_profiles', 'bikes', 'suspension_settings',
    'maintenance_records', 'maintenance_schedules', 'gearing_setups'
  ] loop
    execute format('drop policy if exists %I on public.%I', target_table || '_select_own', target_table);
    execute format('drop policy if exists %I on public.%I', target_table || '_insert_own', target_table);
    execute format('drop policy if exists %I on public.%I', target_table || '_update_own', target_table);
    execute format('drop policy if exists %I on public.%I', target_table || '_delete_own', target_table);
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)', target_table || '_select_own', target_table);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', target_table || '_insert_own', target_table);
    execute format('create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', target_table || '_update_own', target_table);
    execute format('create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', target_table || '_delete_own', target_table);
  end loop;
end;
$$;
