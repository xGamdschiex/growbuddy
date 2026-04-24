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

-- User sieht nur eigene Grows
create policy "Users see own grows" on grows
  for select using (auth.uid() = user_id);

create policy "Users insert own grows" on grows
  for insert with check (auth.uid() = user_id);

create policy "Users update own grows" on grows
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users delete own grows" on grows
  for delete using (auth.uid() = user_id);

-- User sieht nur eigene Check-ins
create policy "Users see own checkins" on checkins
  for select using (auth.uid() = user_id);

-- Hardening (RLS_AUDIT F2): grow_id muss zum eigenen User gehören
create policy "Users insert own checkins" on checkins
  for insert with check (
    auth.uid() = user_id
    and exists (select 1 from grows g where g.id = grow_id and g.user_id = auth.uid())
  );

create policy "Users update own checkins" on checkins
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

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
create policy "Users upload own photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'checkin-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users read own photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'checkin-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users update own photos"
  on storage.objects for update to authenticated
  using (bucket_id = 'checkin-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users delete own photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'checkin-photos' and (storage.foldername(name))[1] = auth.uid()::text);
