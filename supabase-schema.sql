-- Recipe Manager — Supabase schema for cloud sync.
-- Run this once in your Supabase project: Dashboard → SQL Editor → New query →
-- paste this → Run. It creates one table that stores each user's app data as a
-- JSON blob, locked down so users can only read/write their own row.

create table if not exists public.app_state (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

-- Each signed-in user may only see and modify their own row.
drop policy if exists "Users manage their own app_state" on public.app_state;
create policy "Users manage their own app_state"
  on public.app_state
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
