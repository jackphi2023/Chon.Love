alter table public.profiles add column if not exists public_profile_code text;

create or replace function private.assign_public_profile_code()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare v_code text;
begin
  if new.public_profile_code is not null and new.public_profile_code ~ '^[0-9a-f]{6}$' then return new; end if;
  loop
    v_code := substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
    exit when not exists (select 1 from public.profiles p where p.public_profile_code = v_code);
  end loop;
  new.public_profile_code := v_code;
  return new;
end;
$$;
revoke all on function private.assign_public_profile_code() from public, anon, authenticated;

drop trigger if exists profiles_assign_public_profile_code on public.profiles;
create trigger profiles_assign_public_profile_code before insert on public.profiles for each row execute function private.assign_public_profile_code();

do $$
declare v_id uuid; v_code text;
begin
  for v_id in select p.id from public.profiles p where p.public_profile_code is null loop
    loop
      v_code := substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
      exit when not exists (select 1 from public.profiles p where p.public_profile_code = v_code);
    end loop;
    update public.profiles set public_profile_code = v_code where id = v_id;
  end loop;
end;
$$;

alter table public.profiles alter column public_profile_code set not null;
create unique index if not exists profiles_public_profile_code_uidx on public.profiles(public_profile_code);
alter table public.profiles drop constraint if exists profiles_public_profile_code_format_check;
alter table public.profiles add constraint profiles_public_profile_code_format_check check (public_profile_code ~ '^[0-9a-f]{6}$');

create or replace function public.get_public_chon_profile(p_code text)
returns table(
  public_profile_code text, display_name text, headline text, bio text, gender public.gender_identity, age smallint,
  province_name text, interests text[], height_cm smallint, relationship_status public.relationship_status,
  education_level public.education_level, occupation text, looking_for text, membership_tier public.luxy_membership_tier,
  membership_badge_visible boolean, member_since timestamptz, avatar_available boolean
)
language sql stable security definer set search_path=''
as $$
  select p.public_profile_code,p.display_name,p.headline,p.bio,p.gender,
    extract(year from age(current_date, ui.date_of_birth))::smallint,area.name_vi,coalesce(p.interests, '{}'::text[]),
    p.height_cm,p.relationship_status,p.education_level,p.occupation,p.looking_for,
    private.get_active_luxy_membership_tier(p.id),private.get_active_luxy_membership_tier(p.id) in ('premium','diamond'),p.created_at,
    exists (select 1 from public.media_assets m where m.id=p.avatar_media_id and m.owner_id=p.id and m.visibility='avatar' and m.moderation_status='approved' and m.deleted_at is null and m.uploaded_at is not null)
  from public.profiles p
  join private.user_identity ui on ui.user_id=p.id
  left join public.administrative_areas area on area.id=p.province_id and area.country_code='VN' and area.is_active
  where p.public_profile_code=lower(btrim(coalesce(p_code,''))) and p.profile_status='active' and p.deleted_at is null
    and p.discovery_enabled=true and private.is_active_adult(p.id)
  limit 1;
$$;
revoke all on function public.get_public_chon_profile(text) from public;
grant execute on function public.get_public_chon_profile(text) to anon, authenticated, service_role;
comment on column public.profiles.public_profile_code is 'Opaque six-character public identifier used only for shareable Chon.Love member profile URLs.';
comment on function public.get_public_chon_profile(text) is 'Public, privacy-minimized profile projection for shareable Chon.Love member pages; excludes UUIDs, exact birth dates, private media and precise location.';
