-- MyFan Phase B / Session 11
-- Explicit deny policies, least-privilege grants and missing FK indexes.

create index if not exists account_holds_created_by_idx
  on private.account_holds(created_by);
create index if not exists account_holds_released_by_idx
  on private.account_holds(released_by)
  where released_by is not null;
create index if not exists bank_accounts_verified_by_idx
  on private.bank_accounts(verified_by)
  where verified_by is not null;
create index if not exists kyc_profiles_reviewed_by_idx
  on private.kyc_profiles(reviewed_by)
  where reviewed_by is not null;
create index if not exists withdrawals_reviewed_by_idx
  on private.withdrawals(reviewed_by)
  where reviewed_by is not null;

-- The moderation queue is managed only through privileged server operations.
revoke all privileges on table public.moderation_cases from public, anon, authenticated;
grant all privileges on table public.moderation_cases to service_role;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname='public'
      and tablename='moderation_cases'
      and policyname='moderation_cases_deny_client_access'
  ) then
    create policy moderation_cases_deny_client_access
      on public.moderation_cases
      as restrictive
      for all
      to anon, authenticated
      using (false)
      with check (false);
  end if;
end $$;

-- Private-schema tables are already unreachable because anon/authenticated have
-- no schema usage or table grants. Explicit restrictive policies make that
-- deny-by-default intent testable and preserve defense in depth.
do $$
declare
  target record;
begin
  for target in
    select n.nspname as schema_name, c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='private'
      and c.relkind='r'
      and c.relrowsecurity
      and not exists (
        select 1
        from pg_policies p
        where p.schemaname=n.nspname
          and p.tablename=c.relname
      )
    order by c.relname
  loop
    execute format(
      'create policy deny_client_access on %I.%I as restrictive for all to anon, authenticated using (false) with check (false)',
      target.schema_name,
      target.table_name
    );
  end loop;
end $$;

revoke all privileges on all tables in schema private from public, anon, authenticated;
revoke all privileges on all sequences in schema private from public, anon, authenticated;
revoke usage on schema private from public, anon, authenticated;

comment on policy moderation_cases_deny_client_access on public.moderation_cases is
  'Session 11: moderation cases are server/admin only; clients use redacted RPCs and report APIs.';
