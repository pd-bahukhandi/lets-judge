-- ============================================================
-- Let's Judge – Supabase Database Setup
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================


-- ── 1. PROFILES ────────────────────────────────────────────
-- One row per user, mirroring auth.users.
-- Created automatically by the trigger below.

create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  username   text unique not null,
  role       text not null default 'judge'
               check (role in ('admin', 'judge')),
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

-- Anyone authenticated can read all profiles (needed for admin page join)
create policy "profiles: authenticated read"
  on public.profiles for select
  to authenticated
  using (true);

-- Users can update only their own profile
create policy "profiles: own update"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);


-- ── 2. TEAMS ───────────────────────────────────────────────
-- Pre-seeded. No insert/update policy – managed via dashboard.

create table if not exists public.teams (
  id         uuid primary key default gen_random_uuid(),
  name       text unique not null,
  created_at timestamptz default now()
);

alter table public.teams enable row level security;

create policy "teams: authenticated read"
  on public.teams for select
  to authenticated
  using (true);


-- ── 3. SCORES ──────────────────────────────────────────────
-- One row per judge × team (enforced by UNIQUE constraint).
-- total is a generated column — always = sum of the five categories.

create table if not exists public.scores (
  id                  uuid primary key default gen_random_uuid(),
  judge_id            uuid not null references public.profiles(id) on delete cascade,
  team_id             uuid not null references public.teams(id)    on delete cascade,
  ai_innovation       integer not null check (ai_innovation       between 0 and 20),
  business_impact     integer not null check (business_impact     between 0 and 30),
  technical_execution integer not null check (technical_execution between 0 and 30),
  usability           integer not null check (usability           between 0 and 10),
  presentation        integer not null check (presentation        between 0 and 10),
  total               integer generated always as (
                        ai_innovation + business_impact +
                        technical_execution + usability + presentation
                      ) stored,
  updated_at          timestamptz default now(),
  unique (judge_id, team_id)
);

alter table public.scores enable row level security;

-- All authenticated users can read all scores (leaderboard + admin page)
create policy "scores: authenticated read"
  on public.scores for select
  to authenticated
  using (true);

-- Judges can only insert/update their own rows
create policy "scores: own insert"
  on public.scores for insert
  to authenticated
  with check (auth.uid() = judge_id);

create policy "scores: own update"
  on public.scores for update
  to authenticated
  using (auth.uid() = judge_id);


-- ── 4. TRIGGER: auto-create profile on sign-up ─────────────
-- Extracts username from the email prefix (e.g. alice@judging.app → alice)

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, split_part(new.email, '@', 1));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ── 5. Enable Realtime for the scores table ────────────────
-- Required for the live leaderboard to receive push updates.

alter publication supabase_realtime add table public.scores;


-- ── 6. SEED: add your hackathon teams ──────────────────────
-- Replace / extend these with the real team names.

insert into public.teams (name) values
  ('Team Alpha'),
  ('Team Beta'),
  ('Team Gamma'),
  ('Team Delta'),
  ('Team Epsilon')
on conflict (name) do nothing;


-- ── 7. HOW TO CREATE USERS ─────────────────────────────────
-- Go to: Supabase Dashboard → Authentication → Users → Invite user
--   Email format:  <username>@judging.app
--   Example:       alice@judging.app  (username = "alice")
--
-- To make someone an admin, run:
--   update public.profiles set role = 'admin' where username = 'alice';
