-- RLS + quota tests. Run after auth_shim.sql and migrations (see scripts/test-db.sh).
\set ON_ERROR_STOP on
\o /dev/null
grant select, insert, update, delete on public.saved_runs to authenticated;
grant select on public.ai_usage to authenticated;
insert into auth.users values ('00000000-0000-0000-0000-00000000000a', 'a@test'), ('00000000-0000-0000-0000-00000000000b', 'b@test');

-- user A saves a run
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
insert into public.saved_runs (tool, name, params, summary, seed) values ('monte-carlo', 'A run', 'a=crypto:BTC', '{"median": 1}', 42);
do $$ begin assert (select count(*) from public.saved_runs) = 1, 'A sees own row'; end $$;

-- user B cannot see, update or delete A's row, nor insert as A
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
do $$ begin assert (select count(*) from public.saved_runs) = 0, 'B must not see A rows'; end $$;
update public.saved_runs set name = 'hacked';
delete from public.saved_runs;
do $$
begin
  begin
    insert into public.saved_runs (user_id, tool, name, params) values ('00000000-0000-0000-0000-00000000000a', 'portfolio', 'spoof', '');
    raise exception 'spoofed insert should fail';
  exception when insufficient_privilege then null; -- RLS violation
  end;
end $$;

-- back to A: row intact
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
do $$ begin assert (select name from public.saved_runs) = 'A run', 'A row untouched by B'; end $$;

-- invalid tool rejected by CHECK
do $$
begin
  begin
    insert into public.saved_runs (tool, name, params) values ('rm -rf', 'x', '');
    raise exception 'check constraint should fail';
  exception when check_violation then null;
  end;
end $$;

-- AI quota: limit 2 per day
do $$ begin
  assert public.consume_ai_quota(2) = 1, 'first call leaves 1';
  assert public.consume_ai_quota(2) = 0, 'second call leaves 0';
  assert public.consume_ai_quota(2) = -1, 'third call is refused';
end $$;
-- B has an independent quota and cannot read A's usage
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
do $$ begin
  assert public.consume_ai_quota(2) = 1, 'B quota independent';
  assert (select count(*) from public.ai_usage) = 1, 'B sees only own usage row';
end $$;
-- unauthenticated callers are rejected
select set_config('request.jwt.claim.sub', '', false);
do $$
begin
  begin
    perform public.consume_ai_quota(2);
    raise exception 'anon quota should fail';
  exception when sqlstate '28000' then null;
  end;
end $$;
reset role;
\o
\echo 'RLS + quota tests passed'
