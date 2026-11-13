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

-- Phase 2 Beta: Check-in Likes
create table if not exists checkin_likes (
  user_id uuid not null references auth.users(id) on delete cascade,
  checkin_id uuid not null references checkins(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, checkin_id)
);
alter table checkin_likes enable row level security;

drop policy if exists "Likes public read" on checkin_likes;
create policy "Likes public read" on checkin_likes
  for select to authenticated, anon
  using (true);

drop policy if exists "Likes own insert" on checkin_likes;
create policy "Likes own insert" on checkin_likes
  for insert with check (auth.uid() = user_id);

drop policy if exists "Likes own delete" on checkin_likes;
create policy "Likes own delete" on checkin_likes
  for delete using (auth.uid() = user_id);

create index if not exists idx_likes_checkin on checkin_likes(checkin_id);

-- Phase 2 Beta: Follows
create table if not exists follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  followee_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
alter table follows enable row level security;

drop policy if exists "Follows public read" on follows;
create policy "Follows public read" on follows
  for select to authenticated, anon
  using (true);

drop policy if exists "Follows own insert" on follows;
create policy "Follows own insert" on follows
  for insert with check (auth.uid() = follower_id);

drop policy if exists "Follows own delete" on follows;
create policy "Follows own delete" on follows
  for delete using (auth.uid() = follower_id);

create index if not exists idx_follows_follower on follows(follower_id);
create index if not exists idx_follows_followee on follows(followee_id);

-- Phase 2 Beta: Reports (Moderation, einfach)
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  checkin_id uuid references checkins(id) on delete cascade,
  reason text not null,
  details text,
  created_at timestamptz not null default now()
);
alter table reports enable row level security;

drop policy if exists "Reports own insert" on reports;
create policy "Reports own insert" on reports
  for insert with check (auth.uid() = reporter_id);

drop policy if exists "Reports own read" on reports;
create policy "Reports own read" on reports
  for select using (auth.uid() = reporter_id);

create index if not exists idx_reports_checkin on reports(checkin_id);

-- ─── 2026-05-05 Migration: nutrient_ml + water_ml als real (war fälschlich integer) ───
alter table checkins alter column nutrient_ml type real using nutrient_ml::real;
alter table checkins alter column water_ml type real using water_ml::real;

-- ─── GERÄTE-RELAY (v1.4.23): Raspberry-Pi-Bridge ↔ App ─────────────────
-- Ein Pi neben dem Zelt spricht per Bluetooth mit Lampe/Lüfter und tauscht
-- Status, Messwerte und Befehle über diese Tabellen mit der App aus.
-- Zugriff NUR über die Funktionen unten (security definer). Die Tabellen
-- selbst sind für anon/authenticated gesperrt (RLS an, keine Policies).
-- Block ist idempotent und kann erneut ausgeführt werden.

create table if not exists device_bridges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,  -- NULL bis gekoppelt
  name text not null default 'Zelt',
  token_hash text not null unique,   -- sha256(Token) hex; das Token bleibt auf dem Pi
  pair_code text,                    -- 8 Zeichen, einmalig, gültig bis pair_expires
  pair_expires timestamptz,
  grow_id uuid,                      -- optional zugeordneter Grow (kein FK: lokal-first)
  last_seen timestamptz,
  watch_until timestamptz,           -- App schaut zu → Bridge fragt häufiger nach
  pause_until timestamptz,           -- Bluetooth freigegeben (z. B. für Mars Legacy)
  info jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists device_state (
  bridge_id uuid not null references device_bridges(id) on delete cascade,
  device_key text not null,
  kind text not null check (kind in ('lamp', 'fan')),
  name text not null default '',
  state jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (bridge_id, device_key)
);

-- 5-Minuten-Mittel je Bridge (= je Zelt)
create table if not exists device_readings (
  bridge_id uuid not null references device_bridges(id) on delete cascade,
  t timestamptz not null,
  temp_c real,
  rh real,
  fan_pct smallint,
  fan_rpm integer,
  lamp_pct smallint,
  lamp_on boolean,
  primary key (bridge_id, t)
);

create table if not exists device_commands (
  id uuid primary key default gen_random_uuid(),
  bridge_id uuid not null references device_bridges(id) on delete cascade,
  device_key text not null,
  action text not null check (action in ('power', 'level')),
  value integer not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'done', 'failed')),
  error text,
  created_at timestamptz not null default now(),
  done_at timestamptz
);

create unique index if not exists idx_device_bridges_pair on device_bridges(pair_code) where pair_code is not null;
create index if not exists idx_device_bridges_user on device_bridges(user_id);
create index if not exists idx_device_commands_open on device_commands(bridge_id, status, created_at);

alter table device_bridges enable row level security;
alter table device_state enable row level security;
alter table device_readings enable row level security;
alter table device_commands enable row level security;

revoke all on device_bridges, device_state, device_readings, device_commands from public, anon, authenticated;

-- Bridge (Pi) meldet sich an und bekommt einen Kopplungscode.
create or replace function public.bridge_register(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash text;
  v_id uuid;
  v_user uuid;
  v_exists boolean;
  v_code text;
begin
  if p_token is null or length(p_token) < 32 or length(p_token) > 200 then
    raise exception 'invalid token';
  end if;
  v_hash := encode(sha256(convert_to(p_token, 'UTF8')), 'hex');

  -- Aufräumen: nie gekoppelte Bridges, die sich 24 h nicht gemeldet haben
  delete from public.device_bridges
   where user_id is null and coalesce(last_seen, created_at) < now() - interval '24 hours';

  select b.id, b.user_id into v_id, v_user from public.device_bridges b where b.token_hash = v_hash;
  v_exists := found;
  if v_exists and v_user is not null then
    return jsonb_build_object('claimed', true);
  end if;

  -- 8 Zeichen ohne verwechselbare (0/O, 1/I), 40 Bit Zufall
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (get_byte(s.b, i.n) & 31) + 1, 1), '')
    into v_code
    from (select uuid_send(gen_random_uuid()) as b) s, generate_series(8, 15) as i(n);

  if v_exists then
    update public.device_bridges
       set pair_code = v_code, pair_expires = now() + interval '15 minutes', last_seen = now()
     where id = v_id;
  else
    if (select count(*) from public.device_bridges where user_id is null) >= 200 then
      raise exception 'too many unclaimed bridges';
    end if;
    insert into public.device_bridges (token_hash, pair_code, pair_expires, last_seen)
    values (v_hash, v_code, now() + interval '15 minutes', now());
  end if;

  return jsonb_build_object('claimed', false, 'pair_code', v_code, 'expires_s', 900);
end;
$$;

-- Nutzer bindet eine Bridge per Kopplungscode an sein Konto.
create or replace function public.bridge_claim(p_pair_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  v_code := upper(regexp_replace(coalesce(p_pair_code, ''), '[^A-Za-z0-9]', '', 'g'));
  if length(v_code) <> 8 then
    raise exception 'invalid code';
  end if;
  update public.device_bridges
     set user_id = v_uid, pair_code = null, pair_expires = null
   where pair_code = v_code and user_id is null and pair_expires > now()
  returning id into v_id;
  if v_id is null then
    raise exception 'invalid code';
  end if;
  return v_id;
end;
$$;

-- Bridge liefert Status/Messwerte/Quittungen und holt offene Befehle ab.
-- Befehle verfallen nach DB-Uhr (der Pi hat keine Echtzeituhr): nie verspätet schalten.
create or replace function public.bridge_sync(
  p_token text,
  p_states jsonb default '[]',
  p_readings jsonb default '[]',
  p_acks jsonb default '[]',
  p_info jsonb default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_b public.device_bridges;
  v_paused boolean;
  v_cmds jsonb := '[]'::jsonb;
begin
  if p_token is null or length(p_token) < 32 or length(p_token) > 200 then
    raise exception 'invalid token';
  end if;
  select * into v_b from public.device_bridges b
   where b.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
  if not found then
    raise exception 'unknown bridge';
  end if;

  update public.device_bridges
     set last_seen = now(),
         info = case when jsonb_typeof(p_info) = 'object' then p_info else info end
   where id = v_b.id;

  if v_b.user_id is null then
    return jsonb_build_object('claimed', false, 'now', extract(epoch from now()));
  end if;

  if jsonb_typeof(p_states) = 'array' then
    insert into public.device_state (bridge_id, device_key, kind, name, state, updated_at)
    select v_b.id, q.device_key, q.kind, q.name, q.state, now()
      from (
        select distinct on (s.device_key)
               s.device_key, s.kind, coalesce(s.name, '') as name, coalesce(s.state, '{}'::jsonb) as state
          from jsonb_to_recordset(p_states) as s(device_key text, kind text, name text, state jsonb)
         where s.device_key is not null and length(s.device_key) between 1 and 64
           and s.kind in ('lamp', 'fan')
         order by s.device_key
         limit 8
      ) q
    on conflict (bridge_id, device_key) do update
       set kind = excluded.kind, name = excluded.name, state = excluded.state, updated_at = now();
  end if;

  if jsonb_typeof(p_readings) = 'array' then
    insert into public.device_readings (bridge_id, t, temp_c, rh, fan_pct, fan_rpm, lamp_pct, lamp_on)
    select v_b.id, q.t, q.temp_c, q.rh, q.fan_pct, q.fan_rpm, q.lamp_pct, q.lamp_on
      from (
        select distinct on (r.t) r.t, r.temp_c, r.rh, r.fan_pct, r.fan_rpm, r.lamp_pct, r.lamp_on
          from jsonb_to_recordset(p_readings)
               as r(t timestamptz, temp_c real, rh real, fan_pct smallint, fan_rpm integer, lamp_pct smallint, lamp_on boolean)
         where r.t is not null
           and r.t <= now() + interval '10 minutes'
           and r.t > now() - interval '400 days'
         order by r.t
         limit 300
      ) q
    on conflict (bridge_id, t) do update
       set temp_c = excluded.temp_c, rh = excluded.rh, fan_pct = excluded.fan_pct,
           fan_rpm = excluded.fan_rpm, lamp_pct = excluded.lamp_pct, lamp_on = excluded.lamp_on;
  end if;

  if jsonb_typeof(p_acks) = 'array' then
    update public.device_commands c
       set status = case when a.ok then 'done' else 'failed' end,
           error = case when a.ok then null else left(coalesce(a.error, 'failed'), 200) end,
           done_at = now()
      from jsonb_to_recordset(p_acks) as a(id uuid, ok boolean, error text)
     where c.id = a.id and c.bridge_id = v_b.id and c.status in ('pending', 'sent');
  end if;

  update public.device_commands c
     set status = 'failed', error = 'timeout', done_at = now()
   where c.bridge_id = v_b.id
     and ((c.status = 'pending' and c.created_at < now() - interval '45 seconds')
       or (c.status = 'sent' and c.created_at < now() - interval '120 seconds'));

  v_paused := v_b.pause_until is not null and v_b.pause_until > now();
  if v_paused then
    update public.device_commands c
       set status = 'failed', error = 'paused', done_at = now()
     where c.bridge_id = v_b.id and c.status = 'pending';
  else
    with picked as (
      update public.device_commands c
         set status = 'sent'
       where c.bridge_id = v_b.id and c.status = 'pending'
      returning c.id, c.device_key, c.action, c.value, c.created_at
    )
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', p.id, 'device_key', p.device_key, 'action', p.action, 'value', p.value
           ) order by p.created_at), '[]'::jsonb)
      into v_cmds
      from picked p;
  end if;

  return jsonb_build_object(
    'claimed', true,
    'now', extract(epoch from now()),
    'fast', v_b.watch_until is not null and v_b.watch_until > now(),
    'pause_s', case when v_paused then ceil(extract(epoch from (v_b.pause_until - now())))::int else 0 end,
    'commands', v_cmds
  );
end;
$$;

-- App: Status der eigenen Bridge holen und der Bridge signalisieren, dass jemand zuschaut.
create or replace function public.device_poll(p_bridge uuid default null, p_watch boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_b public.device_bridges;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  select * into v_b from public.device_bridges b
   where b.user_id = v_uid and (p_bridge is null or b.id = p_bridge)
   order by b.created_at desc
   limit 1;
  if not found then
    return jsonb_build_object('now', extract(epoch from now()), 'bridge', null);
  end if;
  if p_watch then
    update public.device_bridges set watch_until = now() + interval '20 seconds' where id = v_b.id;
  end if;
  return jsonb_build_object(
    'now', extract(epoch from now()),
    'bridge', jsonb_build_object(
      'id', v_b.id,
      'name', v_b.name,
      'grow_id', v_b.grow_id,
      'last_seen', extract(epoch from v_b.last_seen),
      'pause_until', extract(epoch from v_b.pause_until),
      'info', v_b.info
    ),
    'devices', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'device_key', d.device_key, 'kind', d.kind, 'name', d.name,
               'state', d.state, 'updated_at', extract(epoch from d.updated_at)
             ) order by d.kind desc, d.device_key), '[]'::jsonb)
        from public.device_state d
       where d.bridge_id = v_b.id
    ),
    'commands', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', c.id, 'device_key', c.device_key, 'action', c.action,
               'value', c.value, 'status', c.status, 'error', c.error
             ) order by c.created_at), '[]'::jsonb)
        from public.device_commands c
       where c.bridge_id = v_b.id and c.created_at > now() - interval '3 minutes'
    )
  );
end;
$$;

-- App: Befehl einreihen. Nur Aktionen, die die Bridge für das Gerät freigibt (state.caps).
create or replace function public.device_command(p_bridge uuid, p_device_key text, p_action text, p_value integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_kind text;
  v_state jsonb;
  v_value integer;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if p_action is null or p_action not in ('power', 'level') or p_value is null then
    raise exception 'invalid command';
  end if;
  select d.kind, d.state into v_kind, v_state
    from public.device_state d
    join public.device_bridges b on b.id = d.bridge_id
   where b.id = p_bridge and b.user_id = v_uid and d.device_key = p_device_key;
  if not found then
    raise exception 'unknown device';
  end if;
  if coalesce(v_state #>> array['caps', p_action], 'false') <> 'true' then
    raise exception 'unsupported';
  end if;
  if (select count(*) from public.device_commands c
       where c.bridge_id = p_bridge and c.created_at > now() - interval '1 minute') >= 30 then
    raise exception 'rate limit';
  end if;

  if p_action = 'power' then
    v_value := case when p_value <> 0 then 1 else 0 end;
  else
    v_value := greatest(case v_kind when 'lamp' then 10 else 25 end, least(100, p_value));
  end if;

  -- Offenen Befehl gleicher Art ersetzen (Regler wird schnell bewegt)
  update public.device_commands c
     set status = 'failed', error = 'superseded', done_at = now()
   where c.bridge_id = p_bridge and c.device_key = p_device_key
     and c.action = p_action and c.status = 'pending';

  insert into public.device_commands (bridge_id, device_key, action, value)
  values (p_bridge, p_device_key, p_action, v_value)
  returning id into v_id;

  update public.device_bridges
     set watch_until = greatest(coalesce(watch_until, now()), now() + interval '20 seconds')
   where id = p_bridge;
  return v_id;
end;
$$;

-- App: Verlauf, serverseitig auf höchstens 500 Punkte verdichtet (PostgREST kappt sonst bei 1000 Zeilen).
create or replace function public.device_history(p_bridge uuid, p_from timestamptz, p_to timestamptz, p_bucket_s integer default 300)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_bucket integer := greatest(300, coalesce(p_bucket_s, 300));
  v_out jsonb;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if not exists (select 1 from public.device_bridges b where b.id = p_bridge and b.user_id = v_uid) then
    raise exception 'unknown bridge';
  end if;
  if p_from is null or p_to is null or p_to <= p_from
     or extract(epoch from (p_to - p_from)) / v_bucket > 500 then
    raise exception 'invalid range';
  end if;
  select coalesce(jsonb_agg(to_jsonb(q) order by q.t), '[]'::jsonb) into v_out
    from (
      select extract(epoch from date_bin(make_interval(secs => v_bucket), r.t, timestamptz '2000-01-01 00:00:00+00'))::bigint as t,
             round(avg(r.temp_c)::numeric, 2) as temp_c,
             round(avg(r.rh)::numeric, 1) as rh,
             round(avg(r.fan_pct))::int as fan_pct,
             round(avg(r.fan_rpm))::int as fan_rpm,
             round(avg(r.lamp_pct))::int as lamp_pct,
             bool_or(r.lamp_on) as lamp_on
        from public.device_readings r
       where r.bridge_id = p_bridge and r.t >= p_from and r.t < p_to
       group by 1
    ) q;
  return v_out;
end;
$$;

-- App: Bluetooth für N Minuten freigeben (0 = fortsetzen).
create or replace function public.device_pause(p_bridge uuid, p_minutes integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  update public.device_bridges
     set pause_until = case when coalesce(p_minutes, 0) <= 0 then null
                            else now() + make_interval(mins => least(p_minutes, 60)) end
   where id = p_bridge and user_id = v_uid;
  if not found then
    raise exception 'unknown bridge';
  end if;
end;
$$;

-- App: Grow zuordnen (für phasenabhängige Zielwerte). NULL hebt die Zuordnung auf.
create or replace function public.device_assign_grow(p_bridge uuid, p_grow uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  update public.device_bridges set grow_id = p_grow where id = p_bridge and user_id = v_uid;
  if not found then
    raise exception 'unknown bridge';
  end if;
end;
$$;

-- App: Bridge entkoppeln. Löscht Status, Verlauf und Befehle (Cascade).
create or replace function public.device_unpair(p_bridge uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  delete from public.device_bridges where id = p_bridge and user_id = v_uid;
  if not found then
    raise exception 'unknown bridge';
  end if;
end;
$$;

-- Supabase gibt neuen Funktionen per Default EXECUTE für anon + authenticated → explizit entziehen.
revoke execute on function public.bridge_register(text) from public, anon, authenticated;
revoke execute on function public.bridge_claim(text) from public, anon, authenticated;
revoke execute on function public.bridge_sync(text, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.device_poll(uuid, boolean) from public, anon, authenticated;
revoke execute on function public.device_command(uuid, text, text, integer) from public, anon, authenticated;
revoke execute on function public.device_history(uuid, timestamptz, timestamptz, integer) from public, anon, authenticated;
revoke execute on function public.device_pause(uuid, integer) from public, anon, authenticated;
revoke execute on function public.device_assign_grow(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.device_unpair(uuid) from public, anon, authenticated;

-- Die Bridge nutzt nur den öffentlichen anon key + ihr geheimes Token.
grant execute on function public.bridge_register(text) to anon;
grant execute on function public.bridge_sync(text, jsonb, jsonb, jsonb, jsonb) to anon;
-- Die App braucht ein eingeloggtes Konto.
grant execute on function public.bridge_claim(text) to authenticated;
grant execute on function public.device_poll(uuid, boolean) to authenticated;
grant execute on function public.device_command(uuid, text, text, integer) to authenticated;
grant execute on function public.device_history(uuid, timestamptz, timestamptz, integer) to authenticated;
grant execute on function public.device_pause(uuid, integer) to authenticated;
grant execute on function public.device_assign_grow(uuid, uuid) to authenticated;
grant execute on function public.device_unpair(uuid) to authenticated;
