-- quantphantom — initial schema
-- Saved runs store INPUTS (the tool's URL query) + summary metrics + seed,
-- so results are recomputed instead of storing large arrays.

create extension if not exists pgcrypto;

create table if not exists public.saved_runs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tool        text not null check (tool in ('monte-carlo', 'portfolio', 'backtest')),
  name        text not null check (char_length(name) between 1 and 120),
  params      text not null check (char_length(params) <= 4000),   -- URL query string
  summary     jsonb not null default '{}'::jsonb,
  seed        bigint,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists saved_runs_user_created_idx on public.saved_runs (user_id, created_at desc);

-- Row-level security: every user sees and edits only their own rows.
alter table public.saved_runs enable row level security;

create policy "saved_runs: select own" on public.saved_runs
  for select using (auth.uid() = user_id);
create policy "saved_runs: insert own" on public.saved_runs
  for insert with check (auth.uid() = user_id);
create policy "saved_runs: update own" on public.saved_runs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "saved_runs: delete own" on public.saved_runs
  for delete using (auth.uid() = user_id);

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists saved_runs_touch on public.saved_runs;
create trigger saved_runs_touch before update on public.saved_runs
  for each row execute function public.touch_updated_at();

-- Per-user, per-UTC-day counter for AI explanations.
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day     date not null default (now() at time zone 'utc')::date,
  count   integer not null default 0,
  primary key (user_id, day)
);

alter table public.ai_usage enable row level security;
create policy "ai_usage: select own" on public.ai_usage for select using (auth.uid() = user_id);
-- no insert/update policies: rows change only through the function below.

-- Atomically consume one explanation for the caller. Returns the remaining
-- quota, or −1 when the daily limit is reached. SECURITY DEFINER so it can
-- write ai_usage, but it only ever touches auth.uid()'s own row.
create or replace function public.consume_ai_quota(daily_limit integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  used integer;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  insert into public.ai_usage (user_id, day, count)
    values (uid, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, day) do update
    set count = public.ai_usage.count + 1
    where public.ai_usage.count < daily_limit
  returning count into used;
  if used is null then
    return -1;
  end if;
  return daily_limit - used;
end $$;

revoke all on function public.consume_ai_quota(integer) from public;
grant execute on function public.consume_ai_quota(integer) to authenticated;
