-- Supabase's existing DDL event trigger does not need to be callable by API roles.
-- Keep its owner/trigger behavior intact; only remove unnecessary execution grants.
-- Advisor: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
begin;
do $$
begin
  -- This platform helper is not present on every Supabase/local installation.
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;
commit;
