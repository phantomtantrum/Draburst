-- Minimal stand-in for Supabase's auth schema so migrations + RLS can be
-- tested on plain PostgreSQL. auth.uid() reads the same GUC Supabase uses.
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, email text);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
do $$ begin
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
end $$;
grant usage on schema auth to authenticated, anon;
grant usage on schema public to authenticated, anon;
