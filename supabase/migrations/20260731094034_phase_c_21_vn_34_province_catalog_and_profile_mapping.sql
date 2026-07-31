do $$
declare
  v_expected_codes text[] := array[
    '79','01','31','48','46','92','04','11','12','20','22','38','40','42','14','08','15',
    '19','25','24','33','37','44','51','52','66','56','68','75','80','91','82','86','96'
  ];
  v_existing_count integer;
begin
  select count(*) into v_existing_count
  from public.administrative_areas
  where country_code = 'VN'
    and code = any(v_expected_codes);

  if v_existing_count <> 34 then
    raise exception using errcode = '23514', message = 'vn_34_province_catalog_incomplete';
  end if;
end $$;

update public.administrative_areas as area
set name_vi = source.name_vi,
    name_en = source.name_en,
    area_type = source.area_type,
    parent_id = null,
    country_code = 'VN',
    sort_order = source.sort_order,
    is_active = true,
    updated_at = now()
from (
  values
    ('79','TP. Hồ Chí Minh','Ho Chi Minh City','municipality',1),
    ('01','Hà Nội','Hanoi','municipality',2),
    ('31','Hải Phòng','Hai Phong','municipality',3),
    ('48','Đà Nẵng','Da Nang','municipality',4),
    ('46','Huế','Hue','municipality',5),
    ('92','Cần Thơ','Can Tho','municipality',6),
    ('04','Cao Bằng','Cao Bang','province',7),
    ('11','Điện Biên','Dien Bien','province',8),
    ('12','Lai Châu','Lai Chau','province',9),
    ('20','Lạng Sơn','Lang Son','province',10),
    ('22','Quảng Ninh','Quang Ninh','province',11),
    ('38','Thanh Hóa','Thanh Hoa','province',12),
    ('40','Nghệ An','Nghe An','province',13),
    ('42','Hà Tĩnh','Ha Tinh','province',14),
    ('14','Sơn La','Son La','province',15),
    ('08','Tuyên Quang','Tuyen Quang','province',16),
    ('15','Lào Cai','Lao Cai','province',17),
    ('19','Thái Nguyên','Thai Nguyen','province',18),
    ('25','Phú Thọ','Phu Tho','province',19),
    ('24','Bắc Ninh','Bac Ninh','province',20),
    ('33','Hưng Yên','Hung Yen','province',21),
    ('37','Ninh Bình','Ninh Binh','province',22),
    ('44','Quảng Trị','Quang Tri','province',23),
    ('51','Quảng Ngãi','Quang Ngai','province',24),
    ('52','Gia Lai','Gia Lai','province',25),
    ('66','Đắk Lắk','Dak Lak','province',26),
    ('56','Khánh Hòa','Khanh Hoa','province',27),
    ('68','Lâm Đồng','Lam Dong','province',28),
    ('75','Đồng Nai','Dong Nai','province',29),
    ('80','Tây Ninh','Tay Ninh','province',30),
    ('91','An Giang','An Giang','province',31),
    ('82','Đồng Tháp','Dong Thap','province',32),
    ('86','Vĩnh Long','Vinh Long','province',33),
    ('96','Cà Mau','Ca Mau','province',34)
) as source(code,name_vi,name_en,area_type,sort_order)
where area.code = source.code
  and area.country_code = 'VN';

update public.administrative_areas
set is_active = false,
    updated_at = now()
where country_code = 'VN'
  and parent_id is null
  and area_type in ('province','municipality')
  and code <> all(array[
    '79','01','31','48','46','92','04','11','12','20','22','38','40','42','14','08','15',
    '19','25','24','33','37','44','51','52','66','56','68','75','80','91','82','86','96'
  ]::text[]);

create or replace function private.enforce_vn_34_province_catalog()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_codes constant text[] := array[
    '79','01','31','48','46','92','04','11','12','20','22','38','40','42','14','08','15',
    '19','25','24','33','37','44','51','52','66','56','68','75','80','91','82','86','96'
  ];
begin
  if tg_op = 'DELETE' then
    if old.country_code = 'VN' and old.code = any(v_codes) then
      raise exception using errcode = '23514', message = 'canonical_vn_province_cannot_be_deleted';
    end if;
    return old;
  end if;

  if new.country_code = 'VN'
     and new.parent_id is null
     and new.area_type in ('province','municipality')
  then
    if new.code = any(v_codes) and not new.is_active then
      raise exception using errcode = '23514', message = 'canonical_vn_province_must_remain_active';
    end if;
    if new.code <> all(v_codes) and new.is_active then
      raise exception using errcode = '23514', message = 'noncanonical_vn_province_cannot_be_active';
    end if;
  end if;

  return new;
end $$;
revoke all on function private.enforce_vn_34_province_catalog() from public, anon, authenticated;

drop trigger if exists administrative_areas_enforce_vn_34_catalog on public.administrative_areas;
create trigger administrative_areas_enforce_vn_34_catalog
before insert or update or delete on public.administrative_areas
for each row execute function private.enforce_vn_34_province_catalog();

alter table public.profiles
  drop constraint if exists profiles_province_id_fkey;
alter table public.profiles
  add constraint profiles_province_id_fkey
  foreign key (province_id)
  references public.administrative_areas(id)
  on delete restrict;

alter table public.profiles
  drop constraint if exists profiles_member_requires_province;
alter table public.profiles
  add constraint profiles_member_requires_province
  check (
    province_id is not null
    or profile_status in ('incomplete'::public.profile_status,'deleted'::public.profile_status)
  ) not valid;
alter table public.profiles validate constraint profiles_member_requires_province;

create or replace function private.validate_profile_province_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.province_id is null then
    if new.profile_status not in ('incomplete'::public.profile_status,'deleted'::public.profile_status)
       or new.discovery_enabled
       or new.nearby_enabled
    then
      raise exception using errcode = '23514', message = 'province_required';
    end if;
    return new;
  end if;

  if not exists (
    select 1
    from public.administrative_areas area
    where area.id = new.province_id
      and area.country_code = 'VN'
      and area.parent_id is null
      and area.area_type in ('province','municipality')
      and area.is_active
  ) then
    raise exception using errcode = '23503', message = 'province_not_in_active_vn_34_catalog';
  end if;

  return new;
end $$;
revoke all on function private.validate_profile_province_assignment() from public, anon, authenticated;

drop trigger if exists profiles_validate_province_assignment on public.profiles;
create trigger profiles_validate_province_assignment
before insert or update of province_id, profile_status, discovery_enabled, nearby_enabled
on public.profiles
for each row execute function private.validate_profile_province_assignment();

create or replace function public.update_my_profile(
  p_username text,
  p_display_name text,
  p_bio text default null,
  p_gender public.gender_identity default 'prefer_not_to_say',
  p_province_id bigint default null,
  p_interests text[] default '{}'::text[],
  p_discovery_enabled boolean default true,
  p_nearby_enabled boolean default false
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_existing public.profiles%rowtype;
  v_result public.profiles%rowtype;
  v_new_username extensions.citext;
  v_interests text[] := '{}'::text[];
  v_interest text;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'authentication_required';
  end if;
  if not public.is_current_user_adult() then
    raise exception using errcode = '42501', message = 'adult_onboarding_required';
  end if;

  v_new_username := nullif(pg_catalog.btrim(p_username), '')::extensions.citext;
  if v_new_username is null or v_new_username::text !~ '^[A-Za-z0-9_]{3,30}$' then
    raise exception using errcode = '22023', message = 'invalid_username';
  end if;
  if nullif(pg_catalog.btrim(p_display_name), '') is null
     or pg_catalog.char_length(pg_catalog.btrim(p_display_name)) > 60 then
    raise exception using errcode = '22023', message = 'invalid_display_name';
  end if;
  if p_bio is not null and pg_catalog.char_length(pg_catalog.btrim(p_bio)) > 500 then
    raise exception using errcode = '22023', message = 'invalid_bio';
  end if;
  if p_province_id is null then
    raise exception using errcode = '22023', message = 'province_required';
  end if;
  if not exists (
    select 1
    from public.administrative_areas area
    where area.id = p_province_id
      and area.country_code = 'VN'
      and area.parent_id is null
      and area.area_type in ('province','municipality')
      and area.is_active
  ) then
    raise exception using errcode = '23503', message = 'province_not_in_active_vn_34_catalog';
  end if;

  foreach v_interest in array coalesce(p_interests, '{}'::text[]) loop
    v_interest := pg_catalog.btrim(v_interest);
    if v_interest = '' then continue; end if;
    if pg_catalog.char_length(v_interest) < 2 or pg_catalog.char_length(v_interest) > 32 then
      raise exception using errcode = '22023', message = 'invalid_interests';
    end if;
    if not exists (
      select 1 from pg_catalog.unnest(v_interests) existing
      where pg_catalog.lower(existing) = pg_catalog.lower(v_interest)
    ) then
      v_interests := pg_catalog.array_append(v_interests, v_interest);
    end if;
  end loop;
  if cardinality(v_interests) > 12 then
    raise exception using errcode = '22023', message = 'invalid_interests';
  end if;

  select * into v_existing
  from public.profiles
  where id = v_user_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'profile_not_found';
  end if;
  if v_existing.profile_status in ('suspended','deactivated','deleted') then
    raise exception using errcode = '42501', message = 'account_not_available';
  end if;
  if v_existing.username is not null
     and v_existing.username <> v_new_username
     and v_existing.username_changed_at is not null
     and v_existing.username_changed_at > now() - interval '30 days'
  then
    raise exception using errcode = '22023', message = 'username_change_cooldown';
  end if;

  update public.profiles
  set username = v_new_username,
      display_name = pg_catalog.btrim(p_display_name),
      bio = nullif(pg_catalog.btrim(p_bio), ''),
      gender = p_gender,
      province_id = p_province_id,
      interests = v_interests,
      discovery_enabled = p_discovery_enabled,
      nearby_enabled = p_nearby_enabled,
      profile_status = 'active'::public.profile_status,
      username_changed_at = case
        when v_existing.username is distinct from v_new_username then now()
        else v_existing.username_changed_at
      end
  where id = v_user_id
  returning * into v_result;

  return v_result;
end $$;
revoke all on function public.update_my_profile(text,text,text,public.gender_identity,bigint,text[],boolean,boolean) from public, anon;
grant execute on function public.update_my_profile(text,text,text,public.gender_identity,bigint,text[],boolean,boolean) to authenticated, service_role;

comment on constraint profiles_member_requires_province on public.profiles is
  'Completed member profiles must reference exactly one active top-level location in the canonical 34-province Vietnam catalog. Incomplete/deleted shells may temporarily be null.';