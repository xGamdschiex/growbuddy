-- GrowBuddy Supabase Schema
-- Dieses SQL im Supabase Dashboard unter SQL Editor ausführen.

-- ─── GROWS ─────────────────────────────────────────────────────────────

create table if not exists grows (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default '',
  strain text not null,
  strain_type text not null check (strain_type in ('auto', 'photo')),
  medium text not null,
  space text not null,
  feedline_id text not null,
  light_info text not null default '',
  plant_count int not null default 1,
  status text not null default 'active' check (status in ('active', 'harvested', 'abandoned')),
  started_at timestamptz not null default now(),
  harvested_at timestamptz,
  yield_g real,
  grow_score real,
  notes text not null default '',
  system text default 'topf' check (system in ('topf', 'autopot', 'dwc', 'rdwc')),
  coco_perlite_ratio int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Migration für bestehende DBs (idempotent):
alter table grows add column if not exists system text default 'topf' check (system in ('topf', 'autopot', 'dwc', 'rdwc'));
alter table grows add column if not exists coco_perlite_ratio int;

-- ─── CHECKINS ──────────────────────────────────────────────────────────

create table if not exists checkins (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  grow_id uuid not null references grows(id) on delete cascade,
  phase text not null,
  week int not null default 1,
  day int not null default 1,
  temp real,
  rh real,
  vpd real,
  ec_measured real,
  ph_measured real,
  watered boolean not null default false,
  nutrients_given boolean not null default false,
  water_ml real,
  nutrient_ml real,
  training text,
  notes text not null default '',
  has_photo boolean not null default false,
  photo_url text,
  photo_urls text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Migration für existierende DB (idempotent):
alter table checkins add column if not exists photo_url text;
alter table checkins add column if not exists photo_urls text[] not null default '{}';
alter table checkins add column if not exists water_ml real;
alter table checkins add column if not exists nutrient_ml real;
alter table checkins add column if not exists updated_at timestamptz not null default now();

-- ─── RLS (Row Level Security) ──────────────────────────────────────────

alter table grows enable row level security;
alter table checkins enable row level security;

-- User sieht nur eigene Grows (idempotent — drop+recreate)
drop policy if exists "Users see own grows" on grows;
create policy "Users see own grows" on grows
  for select using (auth.uid() = user_id);

drop policy if exists "Users insert own grows" on grows;
create policy "Users insert own grows" on grows
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users update own grows" on grows;
create policy "Users update own grows" on grows
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users delete own grows" on grows;
create policy "Users delete own grows" on grows
  for delete using (auth.uid() = user_id);

-- User sieht nur eigene Check-ins
drop policy if exists "Users see own checkins" on checkins;
create policy "Users see own checkins" on checkins
  for select using (auth.uid() = user_id);

-- Hardening (RLS_AUDIT F2): grow_id muss zum eigenen User gehören
drop policy if exists "Users insert own checkins" on checkins;
create policy "Users insert own checkins" on checkins
  for insert with check (
    auth.uid() = user_id
    and exists (select 1 from grows g where g.id = grow_id and g.user_id = auth.uid())
  );

drop policy if exists "Users update own checkins" on checkins;
create policy "Users update own checkins" on checkins
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users delete own checkins" on checkins;
create policy "Users delete own checkins" on checkins
  for delete using (auth.uid() = user_id);

-- ─── INDEXES ───────────────────────────────────────────────────────────

create index if not exists idx_grows_user on grows(user_id);
create index if not exists idx_checkins_user on checkins(user_id);
create index if not exists idx_checkins_grow on checkins(grow_id);
create index if not exists idx_checkins_created on checkins(grow_id, created_at desc);

-- ─── STORAGE: Check-in Photos Bucket ───────────────────────────────────
-- Im Supabase Dashboard unter Storage manuell erstellen oder via SQL:

insert into storage.buckets (id, name, public)
values ('checkin-photos', 'checkin-photos', false)
on conflict (id) do nothing;

-- RLS für Storage: User darf nur eigene Fotos lesen/schreiben (Pfad: {userId}/{checkinId}.jpg)
drop policy if exists "Users upload own photos" on storage.objects;
create policy "Users upload own photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'checkin-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users read own photos" on storage.objects;
create policy "Users read own photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'checkin-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users update own photos" on storage.objects;
create policy "Users update own photos"
  on storage.objects for update to authenticated
  using (bucket_id = 'checkin-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users delete own photos" on storage.objects;
create policy "Users delete own photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'checkin-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ─── DSGVO: Account-Komplettlöschung ───────────────────────────────────
-- Client-side löscht checkins/grows/storage; dieser RPC entfernt auth.users.
-- security definer, damit der User seinen eigenen auth-Eintrag löschen kann.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  -- Cascade-Deletes greifen über FK auf grows/checkins
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;

-- ─── PHASE 2: PROFILES + COMMUNITY ─────────────────────────────────────

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  bio text not null default '',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

drop policy if exists "Profiles public read" on profiles;
create policy "Profiles public read" on profiles
  for select to authenticated, anon
  using (true);

drop policy if exists "Profiles update own" on profiles;
create policy "Profiles update own" on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Profiles insert own" on profiles;
create policy "Profiles insert own" on profiles
  for insert with check (auth.uid() = id);

-- is_public Flags für Feed
alter table grows add column if not exists is_public boolean not null default false;
alter table checkins add column if not exists is_public boolean not null default false;

-- RLS-Hardening: Public-Rows zusätzlich sichtbar
drop policy if exists "Public grows readable" on grows;
create policy "Public grows readable" on grows
  for select to authenticated, anon
  using (is_public = true);

drop policy if exists "Public checkins readable" on checkins;
create policy "Public checkins readable" on checkins
  for select to authenticated, anon
  using (is_public = true);

-- Auto-Profile bei Signup (Username = "GreenThumb" + 4 Zufallsziffern)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_name text := 'GreenThumb';
  candidate text;
  attempts int := 0;
begin
  loop
    candidate := base_name || (floor(random() * 9000 + 1000)::int)::text;
    begin
      insert into profiles (id, username) values (new.id, candidate);
      exit;
    exception when unique_violation then
      attempts := attempts + 1;
      if attempts > 8 then
        candidate := base_name || extract(epoch from now())::bigint::text;
        insert into profiles (id, username) values (new.id, candidate);
        exit;
      end if;
    end;
  end loop;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill für Bestands-User (idempotent)
insert into profiles (id, username)
  select u.id, 'GreenThumb' || (floor(random() * 9000 + 1000)::int)::text
  from auth.users u
  where not exists (select 1 from profiles p where p.id = u.id)
on conflict (id) do nothing;

create index if not exists idx_profiles_username on profiles(username);
create index if not exists idx_grows_public on grows(is_public, created_at desc) where is_public = true;
create index if not exists idx_checkins_public on checkins(is_public, created_at desc) where is_public = true;
