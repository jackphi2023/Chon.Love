-- LX-07: Seeking-derived Luxy profile schema foundation.
--
-- Privacy boundary:
-- - date_of_birth remains private.user_identity only;
-- - exact coordinates remain private.user_locations only;
-- - public.profiles receives only member-visible/searchable profile attributes.
--
-- Compatibility boundary:
-- - public.update_my_profile(...) remains unchanged for existing clients;
-- - new Luxy clients use public.update_my_luxy_profile(...).

create type public.dating_interest as enum (
  'female',
  'male',
  'everyone'
);

create type public.relationship_status as enum (
  'single',
  'divorced',
  'widowed',
  'open',
  'complicated',
  'prefer_not_to_say'
);

alter table public.profiles
  add column interested_in public.dating_interest not null default 'everyone'::public.dating_interest,
  add column height_cm smallint,
  add column relationship_status public.relationship_status not null default 'prefer_not_to_say'::public.relationship_status;

alter table public.profiles
  add constraint profiles_height_cm_range
  check (height_cm is null or height_cm between 120 and 230);

comment on column public.profiles.interested_in is
  'Public dating preference used for Luxy discovery. Everyone is represented explicitly; this column never contains private identity data.';
comment on column public.profiles.height_cm is
  'Optional public height in centimeters. Nullable for legacy profiles until the Luxy profile setup flow is completed.';
comment on column public.profiles.relationship_status is
  'Public member-selected relationship status. Existing profiles default to prefer_not_to_say for forward compatibility.';

create index profiles_luxy_discovery_match_idx
  on public.profiles (gender, interested_in, province_id)
  where profile_status = 'active'::public.profile_status
    and discovery_enabled
    and deleted_at is null;

create index profiles_luxy_height_idx
  on public.profiles (height_cm)
  where profile_status = 'active'::public.profile_status
    and discovery_enabled
    and deleted_at is null
    and height_cm is not null;

create or replace function public.update_my_luxy_profile(
  p_username text,
  p_display_name text,
  p_bio text default null,
  p_gender public.gender_identity default 'prefer_not_to_say',
  p_province_id bigint default null,
  p_interests text[] default '{}'::text[],
  p_discovery_enabled boolean default true,
  p_nearby_enabled boolean default false,
  p_interested_in public.dating_interest default 'everyone',
  p_height_cm smallint default null,
  p_relationship_status public.relationship_status default 'prefer_not_to_say'
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_result public.profiles%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'authentication_required';
  end if;

  if p_height_cm is not null and (p_height_cm < 120 or p_height_cm > 230) then
    raise exception using errcode = '22023', message = 'invalid_height_cm';
  end if;

  -- Delegate the existing mature validation, province catalog enforcement,
  -- interest normalization, account-state checks, and username cooldown to
  -- the backwards-compatible profile RPC.
  v_result := public.update_my_profile(
    p_username,
    p_display_name,
    p_bio,
    p_gender,
    p_province_id,
    p_interests,
    p_discovery_enabled,
    p_nearby_enabled
  );

  update public.profiles
  set interested_in = p_interested_in,
      height_cm = p_height_cm,
      relationship_status = p_relationship_status
  where id = v_user_id
  returning * into v_result;

  return v_result;
end
$$;

revoke all on function public.update_my_luxy_profile(
  text,
  text,
  text,
  public.gender_identity,
  bigint,
  text[],
  boolean,
  boolean,
  public.dating_interest,
  smallint,
  public.relationship_status
) from public, anon;

grant execute on function public.update_my_luxy_profile(
  text,
  text,
  text,
  public.gender_identity,
  bigint,
  text[],
  boolean,
  boolean,
  public.dating_interest,
  smallint,
  public.relationship_status
) to authenticated, service_role;

comment on function public.update_my_luxy_profile(
  text,
  text,
  text,
  public.gender_identity,
  bigint,
  text[],
  boolean,
  boolean,
  public.dating_interest,
  smallint,
  public.relationship_status
) is
  'LX-07 RPC for public Luxy profile fields. Requires existing adult onboarding through update_my_profile; never writes DOB, KYC, bank data, or exact coordinates.';
