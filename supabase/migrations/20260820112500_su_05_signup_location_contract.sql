-- Chon.Love Signup / Onboarding V2 — SU-05
-- Staged Step 4 location contract for incomplete profiles.
-- Public province/city is stored on profiles; consented exact coordinates stay private.
-- Existing mature set_my_location remains unchanged and continues to require an active adult profile.

create or replace function public.save_my_signup_location_v2(
  p_province_id bigint,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_accuracy_meters integer default null,
  p_captured_at timestamptz default null,
  p_source text default 'device_foreground'
)
returns table(
  province_id bigint,
  nearby_enabled boolean,
  location_saved boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_profile public.profiles%rowtype;
  v_now timestamptz := now();
  v_max_accuracy integer;
  v_stale_days integer;
  v_expires_at timestamptz;
  v_has_any_location boolean;
  v_has_complete_location boolean;
  v_existing_location_enabled boolean := false;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'authentication required';
  end if;

  select p.*
  into v_profile
  from public.profiles as p
  where p.id = v_user_id
  for update;

  if not found then
    raise exception using errcode = '55000', message = 'profile record is missing';
  end if;

  if v_profile.deleted_at is not null
     or v_profile.profile_status is distinct from 'incomplete'::public.profile_status then
    raise exception using errcode = '42501', message = 'signup profile must be incomplete';
  end if;

  -- SU-04 establishes the private DOB + current policy acceptance. Reuse that
  -- authority here without requiring the profile to already be active.
  if not public.is_current_user_adult() then
    raise exception using errcode = '42501', message = 'signup personal info must be completed first';
  end if;

  if p_province_id is null or not exists (
    select 1
    from public.administrative_areas as area
    where area.id = p_province_id
      and area.country_code = 'VN'
      and area.is_active
      and area.parent_id is null
      and area.area_type in ('province', 'municipality')
  ) then
    raise exception using errcode = '22023', message = 'invalid signup province';
  end if;

  v_has_any_location := p_latitude is not null
    or p_longitude is not null
    or p_accuracy_meters is not null
    or p_captured_at is not null;
  v_has_complete_location := p_latitude is not null
    and p_longitude is not null
    and p_accuracy_meters is not null
    and p_captured_at is not null;

  if v_has_any_location and not v_has_complete_location then
    raise exception using errcode = '22023', message = 'signup location payload must be complete';
  end if;

  if p_source not in ('device_foreground', 'device_approximate') then
    raise exception using errcode = '22023', message = 'invalid location source';
  end if;

  if v_has_complete_location then
    if p_latitude < -90 or p_latitude > 90
       or p_longitude < -180 or p_longitude > 180 then
      raise exception using errcode = '22023', message = 'invalid coordinates';
    end if;

    if p_accuracy_meters < 0 then
      raise exception using errcode = '22023', message = 'invalid location accuracy';
    end if;

    if p_captured_at > v_now + interval '5 minutes'
       or p_captured_at < v_now - interval '24 hours' then
      raise exception using errcode = '22023', message = 'invalid location capture time';
    end if;

    select (value_json #>> '{}')::integer
    into v_max_accuracy
    from private.app_config
    where key = 'location_max_accuracy_meters';

    select (value_json #>> '{}')::integer
    into v_stale_days
    from private.app_config
    where key = 'location_stale_after_days';

    if p_accuracy_meters > coalesce(v_max_accuracy, 5000) then
      raise exception using errcode = '22023', message = 'location accuracy too low';
    end if;

    if exists (
      select 1
      from private.location_events as event
      where event.user_id = v_user_id
        and event.event_type = 'set'
        and event.occurred_at > v_now - interval '30 seconds'
    ) then
      raise exception using errcode = '54000', message = 'location update rate limited';
    end if;

    v_expires_at := p_captured_at + make_interval(days => coalesce(v_stale_days, 7));

    insert into private.user_locations(
      user_id,
      location,
      accuracy_meters,
      captured_at,
      consented_at,
      is_enabled,
      source,
      expires_at
    )
    values(
      v_user_id,
      extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)::extensions.geography,
      p_accuracy_meters,
      p_captured_at,
      v_now,
      true,
      p_source,
      v_expires_at
    )
    on conflict(user_id) do update
    set
      location = excluded.location,
      accuracy_meters = excluded.accuracy_meters,
      captured_at = excluded.captured_at,
      consented_at = excluded.consented_at,
      is_enabled = true,
      source = excluded.source,
      expires_at = excluded.expires_at,
      updated_at = v_now;

    insert into private.location_events(user_id, event_type, source, accuracy_meters)
    values(v_user_id, 'set', p_source, p_accuracy_meters);

    update public.profiles
    set
      province_id = p_province_id,
      nearby_enabled = true,
      updated_at = v_now
    where id = v_user_id;

    return query select p_province_id, true, true;
    return;
  end if;

  -- GPS permission is optional. A province-only save must not erase a location
  -- the user already consented to in a previous attempt/session; it only keeps
  -- nearby enabled when that private location is still enabled and unexpired.
  select coalesce(ul.is_enabled and ul.expires_at > v_now, false)
  into v_existing_location_enabled
  from private.user_locations as ul
  where ul.user_id = v_user_id;

  v_existing_location_enabled := coalesce(v_existing_location_enabled, false);

  update public.profiles
  set
    province_id = p_province_id,
    nearby_enabled = v_existing_location_enabled,
    updated_at = v_now
  where id = v_user_id;

  return query select p_province_id, v_existing_location_enabled, false;
end;
$function$;

revoke all on function public.save_my_signup_location_v2(
  bigint,double precision,double precision,integer,timestamptz,text
) from public, anon;

grant execute on function public.save_my_signup_location_v2(
  bigint,double precision,double precision,integer,timestamptz,text
) to authenticated, service_role;

comment on function public.save_my_signup_location_v2(
  bigint,double precision,double precision,integer,timestamptz,text
) is
  'SU-05 staged location write for incomplete adult Signup V2 profiles. Stores only province_id publicly; consented exact coordinates remain in private.user_locations. GPS is optional, existing consent is preserved on province-only retries, and the profile/discovery state is not activated.';