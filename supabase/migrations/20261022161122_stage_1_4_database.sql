-- Stage 1.4. Apply once, in the muziqobbiz project's SQL Editor.
-- Docs checked 2026-10-22:
-- https://supabase.com/docs/guides/database/postgres/row-level-security
-- https://supabase.com/docs/guides/api/securing-your-api
-- https://supabase.com/docs/guides/storage/security/access-control
-- https://supabase.com/docs/guides/storage/buckets/creating-buckets
begin;

create table public.tracks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null default 'Untitled track' check (length(trim(title)) > 0),
  mode text not null default 'vocal_first' check (mode in ('vocal_first', 'beat_first', 'reference')),
  bpm numeric check (bpm > 0 and bpm < 1000),
  musical_key text,
  genre text,
  mood text,
  energy text,
  instrumentation text[] not null default '{}',
  prompt_text text,
  provider text,
  tier text not null default 'draft' check (tier in ('draft', 'release')),
  release_ready boolean not null default false,
  ai_assisted boolean not null default true check (ai_assisted = true),
  vocal_path text,
  instrumental_path text,
  mix_path text,
  offset_ms integer not null default 0,
  vocal_gain numeric not null default 1 check (vocal_gain >= 0 and vocal_gain < 1000),
  instrumental_gain numeric not null default 1 check (instrumental_gain >= 0 and instrumental_gain < 1000),
  vocal_fx jsonb not null default '{}'::jsonb check (jsonb_typeof(vocal_fx) = 'object'),
  parent_track_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tracks_id_owner_unique unique (id, user_id),
  constraint tracks_parent_owner_fkey foreign key (parent_track_id, user_id)
    references public.tracks(id, user_id),
  constraint tracks_no_self_parent check (parent_track_id is distinct from id),
  -- Paid-plan verification belongs to the future server-side release workflow.
  constraint tracks_release_tier_check check (not release_ready or tier = 'release')
);

create table public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  track_id uuid,
  provider text not null check (length(trim(provider)) > 0),
  tier text not null default 'draft' check (tier in ('draft', 'release')),
  prompt_text text not null check (length(trim(prompt_text)) > 0),
  duration_sec integer not null check (duration_sec > 0),
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed')),
  provider_request_id text,
  result_path text,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint generation_jobs_track_owner_fkey foreign key (track_id, user_id)
    references public.tracks(id, user_id)
);

-- Leftmost user_id supports ownership checks; timestamps support lists and quotas.
create index tracks_user_created_idx on public.tracks (user_id, created_at desc);
create index tracks_created_idx on public.tracks (created_at desc);
create index tracks_parent_owner_idx on public.tracks (parent_track_id, user_id);
create index generation_jobs_user_created_idx on public.generation_jobs (user_id, created_at desc);
create index generation_jobs_created_idx on public.generation_jobs (created_at desc);
create index generation_jobs_track_owner_idx on public.generation_jobs (track_id, user_id);

create function public.set_track_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;
revoke all on function public.set_track_updated_at() from public, anon, authenticated;

create trigger tracks_set_updated_at
before update on public.tracks
for each row execute function public.set_track_updated_at();

alter table public.tracks enable row level security;
alter table public.generation_jobs enable row level security;

-- Explicit grants also work on projects without automatic Data API grants.
revoke all on public.tracks, public.generation_jobs from public, anon, authenticated;
grant select, insert, update, delete on public.tracks, public.generation_jobs to authenticated;
grant all on public.tracks, public.generation_jobs to service_role;

create policy tracks_own_rows on public.tracks
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy generation_jobs_own_rows on public.generation_jobs
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- Fail atomically if these already exist; do not silently accept schema drift.
insert into storage.buckets (id, name, public) values
  ('vocals', 'vocals', false),
  ('instrumentals', 'instrumentals', false),
  ('mixes', 'mixes', false);

-- Supabase manages storage.objects and enables RLS. Verify without changing its ownership/schema.
do $$
begin
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'storage' and c.relname = 'objects' and c.relrowsecurity
  ) then
    raise exception 'storage.objects must have RLS enabled before applying this migration';
  end if;
end;
$$;

-- Files use <auth user UUID>/<track UUID>/<filename>. No reference-audio bucket.
create policy music_files_own_folder on storage.objects
for all to authenticated
using (
  bucket_id in ('vocals', 'instrumentals', 'mixes')
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id in ('vocals', 'instrumentals', 'mixes')
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- Keep other permissive storage policies from granting access to these folders.
-- This restriction does not grant access to any unrelated bucket.
create policy music_files_folder_boundary on storage.objects
as restrictive for all to public
using (
  bucket_id not in ('vocals', 'instrumentals', 'mixes')
  or (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id not in ('vocals', 'instrumentals', 'mixes')
  or (storage.foldername(name))[1] = (select auth.uid())::text
);

commit;
