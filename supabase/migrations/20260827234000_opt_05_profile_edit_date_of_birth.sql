-- Chon.Love OPT-05 — Profile/Edit date-of-birth contract.
-- DOB remains private: clients receive only their own value through narrow RPCs.
-- Editing DOB never changes profile/listing/AWS state. A changed value is re-asserted
-- as self-declared age data and must remain within the 18+ product boundary.

create or replace function public.get_my_date_of_birth_v2()
returns table(date_of_birth date)
language sql
stable
security definer
set search_path = ''
as $function$
  select ui.date_of_birth
  from private.user_identity as ui
  where ui.user_id = (select auth.uid());
$function$;

revoke all on function public.get_my_date_of_birth_v2() from public, anon, authenticated;
grant execute on function public.get_my_date_of_birth_v2() to authenticated, service_role;

comment on function public.get_my_date_of_birth_v2() is
  'OPT-05 owner-only DOB read model for Profile/Edit. Returns only auth.uid() date_of_birth from private.user_identity.';

create or replace function public.update_my_date_of_birth_v2(
  p_date_of_birth date
)
returns table(date_of_birth date, age_verified boolean)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_now timestamptz := now();
  v_existing_dob date;
  v_existing_method private.age_verification_method;
  v_account_status private.account_status;
  v_profile_status public.profile_status;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'authentication required';
  end if;

  if p_date_of_birth is null
     or p_date_of_birth < date '1900-01-01'
     or p_date_of_birth > current_date then
    raise exception using errcode = '22008', message = 'invalid date_of_birth';
  end if;

  if p_date_of_birth > (current_date - interval '18 years')::date then
    raise exception using errcode = '22023', message = 'user must be at least 18 years old';
  end if;

  select ui.date_of_birth, ui.age_verification_method, ui.account_status, p.profile_status
  into v_existing_dob, v_existing_method, v_account_status, v_profile_status
  from private.user_identity as ui
  join public.profiles as p on p.id = ui.user_id
  where ui.user_id = v_user_id
  for update of ui, p;

  if not found then
    raise exception using errcode = '55000', message = 'user identity record is missing';
  end if;

  if v_account_status is distinct from 'active'::private.account_status
     or v_profile_status is distinct from 'active'::public.profile_status then
    raise exception using errcode = '42501', message = 'active profile required';
  end if;

  -- A no-op save preserves any stronger historical verification method.
  if v_existing_dob is not distinct from p_date_of_birth then
    return query
    select v_existing_dob, true;
    return;
  end if;

  -- Once the member edits DOB themselves, the age assertion is self-declared again.
  -- This does not touch selfie/AWS verification, profile status, discovery or listing approval.
  update private.user_identity
  set
    date_of_birth = p_date_of_birth,
    age_verified_at = v_now,
    age_verification_method = 'self_declared'::private.age_verification_method,
    updated_at = v_now
  where user_id = v_user_id;

  return query
  select p_date_of_birth, true;
end;
$function$;

revoke all on function public.update_my_date_of_birth_v2(date) from public, anon, authenticated;
grant execute on function public.update_my_date_of_birth_v2(date) to authenticated, service_role;

comment on function public.update_my_date_of_birth_v2(date) is
  'OPT-05 owner-only DOB update for active profiles. Enforces 1900+ and 18+, preserves stronger verification on no-op saves, and marks changed DOB as self-declared without altering AWS/listing/profile state.';
