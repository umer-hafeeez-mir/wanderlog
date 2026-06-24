-- ============================================================
-- Wanderlog — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- TRIPS
create table if not exists trips (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users not null,
  name        text not null,
  start_date  date,
  end_date    date,
  is_public   boolean default true,
  view_count  integer default 0,
  created_at  timestamptz default now()
);

-- MOMENTS
create table if not exists moments (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid references trips(id) on delete cascade not null,
  user_id     uuid references auth.users not null,
  caption     text not null,
  location    text,
  created_at  timestamptz default now()
);

-- MOMENT IMAGES
create table if not exists moment_images (
  id          uuid primary key default gen_random_uuid(),
  moment_id   uuid references moments(id) on delete cascade not null,
  url         text not null,
  position    integer default 0
);

-- REACTIONS
create table if not exists reactions (
  id          uuid primary key default gen_random_uuid(),
  moment_id   uuid references moments(id) on delete cascade not null,
  user_id     uuid references auth.users not null,
  emoji       text default '🫶',
  created_at  timestamptz default now(),
  unique (moment_id, user_id, emoji)
);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table trips         enable row level security;
alter table moments       enable row level security;
alter table moment_images enable row level security;
alter table reactions     enable row level security;

-- Trips: public trips readable by anyone; owner can insert/update/delete
create policy "Public trips are viewable" on trips for select using (is_public = true);
create policy "Owner can manage trips"    on trips for all   using (auth.uid() = user_id);

-- Moments: readable if trip is public; only owner can insert
create policy "Moments viewable for public trips"
  on moments for select
  using (exists (select 1 from trips where id = moments.trip_id and is_public = true));

create policy "Owner can insert moments"
  on moments for insert
  with check (auth.uid() = user_id);

create policy "Owner can delete moments"
  on moments for delete
  using (auth.uid() = user_id);

-- Moment images: follow the trip visibility
create policy "Images viewable for public trips"
  on moment_images for select
  using (exists (
    select 1 from moments m
    join trips t on t.id = m.trip_id
    where m.id = moment_images.moment_id and t.is_public = true
  ));

create policy "Owner can insert images"
  on moment_images for insert
  with check (exists (
    select 1 from moments where id = moment_images.moment_id and user_id = auth.uid()
  ));

-- Reactions: anyone can read; any logged-in user can react
create policy "Reactions readable" on reactions for select using (true);
create policy "Logged in users can react"
  on reactions for insert
  with check (auth.uid() = user_id);
create policy "Users can delete own reactions"
  on reactions for delete
  using (auth.uid() = user_id);

-- ============================================================
-- Storage bucket: moment-images (public)
-- Run separately in Supabase Storage settings or via Dashboard
-- ============================================================
-- insert into storage.buckets (id, name, public) values ('moment-images', 'moment-images', true);
