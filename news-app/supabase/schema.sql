-- News Hammer accounts: run this once in your Supabase project (SQL editor → New query → Run).
-- Each signed-in user gets one row holding their synced settings and saved stories. Row-level
-- security means a user can only ever read or change their own row.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  saved jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select using (auth.uid() = user_id);

drop policy if exists "insert own profile" on public.profiles;
create policy "insert own profile" on public.profiles
  for insert with check (auth.uid() = user_id);

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Lets a signed-in user delete their own account from the app (app stores require this). It runs
-- with the owner's rights but only ever deletes the caller; their profile row goes with it.
create or replace function public.delete_my_account()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = auth.uid();
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
