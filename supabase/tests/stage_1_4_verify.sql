-- Run AFTER the migration, in a new SQL Editor query, as postgres.
-- Uses the existing single owner account. All test records roll back.
begin;

do $$
begin
  if (select count(*) from auth.users) <> 1 then
    raise exception 'Expected one existing owner account. Ask the agent to adapt this test before running it.';
  end if;
  if (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where (n.nspname = 'public' and c.relname in ('tracks', 'generation_jobs')
        or n.nspname = 'storage' and c.relname = 'objects') and c.relrowsecurity) <> 3 then
    raise exception 'A table is missing or RLS is disabled';
  end if;
  if (select count(*) from storage.buckets
      where id in ('vocals', 'instrumentals', 'mixes') and public = false) <> 3 then
    raise exception 'Expected three private music buckets';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', (select id::text from auth.users limit 1), true);
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users limit 1), 'role', 'authenticated')::text, true);
select set_config('test.track_id', gen_random_uuid()::text, true);
select set_config('test.job_id', gen_random_uuid()::text, true);
set local role authenticated;

insert into public.tracks (id, title, updated_at)
values (current_setting('test.track_id')::uuid, 'Stage 1.4 RLS test', '2000-01-01');
insert into public.generation_jobs (id, track_id, provider, prompt_text, duration_sec)
values (current_setting('test.job_id')::uuid, current_setting('test.track_id')::uuid,
  'connection_test', 'Test only; no generation request.', 1);

do $$
begin
  if not exists (select 1 from public.tracks where id = current_setting('test.track_id')::uuid)
    or not exists (select 1 from public.generation_jobs where id = current_setting('test.job_id')::uuid) then
    raise exception 'Owner cannot read inserted rows';
  end if;
  update public.tracks set title = 'Updated test' where id = current_setting('test.track_id')::uuid;
  if not exists (select 1 from public.tracks where id = current_setting('test.track_id')::uuid
      and title = 'Updated test' and updated_at > '2000-01-01') then
    raise exception 'Track update or timestamp trigger failed';
  end if;
  update public.generation_jobs set status = 'running' where id = current_setting('test.job_id')::uuid;
  if not found then raise exception 'Owner cannot update a job'; end if;
  begin
    update public.tracks set user_id = gen_random_uuid() where id = current_setting('test.track_id')::uuid;
    raise exception 'Ownership transfer unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.tracks set ai_assisted = false where id = current_setting('test.track_id')::uuid;
    raise exception 'ai_assisted constraint missing';
  exception when check_violation then null;
  end;
end;
$$;

-- An unrelated authenticated identity must see no owner records.
select set_config('test.owner_id', (select auth.uid())::text, true);
select set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('request.jwt.claim.sub'), 'role', 'authenticated')::text, true);
do $$
begin
  if exists (select 1 from public.tracks where id = current_setting('test.track_id')::uuid)
    or exists (select 1 from public.generation_jobs where id = current_setting('test.job_id')::uuid) then
    raise exception 'Another identity can read owner records';
  end if;
  update public.tracks set title = 'Forbidden' where id = current_setting('test.track_id')::uuid;
  if found then raise exception 'Another identity can update an owner track'; end if;
  delete from public.generation_jobs where id = current_setting('test.job_id')::uuid;
  if found then raise exception 'Another identity can delete an owner job'; end if;
  begin
    insert into public.tracks (user_id) values (current_setting('test.owner_id')::uuid);
    raise exception 'Another identity can insert an owner track';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
set local role anon;
do $$
begin
  begin
    perform id from public.tracks;
    raise exception 'Anonymous table access unexpectedly allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    perform id from public.generation_jobs;
    raise exception 'Anonymous job access unexpectedly allowed';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', current_setting('test.owner_id'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.owner_id'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  delete from public.generation_jobs where id = current_setting('test.job_id')::uuid;
  if not found then raise exception 'Owner cannot delete test job'; end if;
  delete from public.tracks where id = current_setting('test.track_id')::uuid;
  if not found then raise exception 'Owner cannot delete test track'; end if;
end;
$$;

reset role;
rollback;
select 'PASS: tables, private buckets, owner CRUD, timestamp, and row isolation; all test data rolled back' as result;
