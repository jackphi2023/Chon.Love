-- LX-20 trusted admin read contract for profile verification.
-- Raw identity storage paths never reach authenticated consumer clients; these RPCs are service-role only
-- and additionally verify the acting admin identity supplied by the Edge Function.

create or replace function public.admin_list_member_profile_verifications(
  p_actor_user_id uuid,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table(
  user_id uuid,
  username text,
  display_name text,
  identity_status text,
  identity_submitted_at timestamptz,
  linkedin_status text,
  linkedin_profile_url text,
  linkedin_submitted_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_role private.user_role;
  v_limit integer:=least(greatest(coalesce(p_limit,100),1),200);
  v_offset integer:=least(greatest(coalesce(p_offset,0),0),5000);
begin
  v_role:=private.actor_role_for(p_actor_user_id,array['moderator'::private.user_role,'super_admin'::private.user_role]);
  return query
  select
    v.user_id,
    p.username::text,
    p.display_name,
    v.identity_status,
    v.identity_submitted_at,
    v.linkedin_status,
    v.linkedin_profile_url,
    v.linkedin_submitted_at,
    v.updated_at
  from private.member_profile_verifications v
  join public.profiles p on p.id=v.user_id
  where v.identity_status='pending' or v.linkedin_status='pending'
  order by greatest(coalesce(v.identity_submitted_at,'epoch'::timestamptz),coalesce(v.linkedin_submitted_at,'epoch'::timestamptz)) asc,v.user_id
  limit v_limit offset v_offset;
end;
$$;
revoke all on function public.admin_list_member_profile_verifications(uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.admin_list_member_profile_verifications(uuid,integer,integer) to service_role;

create or replace function public.admin_get_member_profile_verification_detail(
  p_actor_user_id uuid,
  p_user_id uuid
)
returns table(
  user_id uuid,
  username text,
  display_name text,
  identity_status text,
  identity_submitted_at timestamptz,
  identity_front_bucket text,
  identity_front_path text,
  identity_back_bucket text,
  identity_back_path text,
  linkedin_status text,
  linkedin_profile_url text,
  linkedin_submitted_at timestamptz
)
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_role private.user_role;
begin
  v_role:=private.actor_role_for(p_actor_user_id,array['moderator'::private.user_role,'super_admin'::private.user_role]);
  if p_user_id is null then raise exception using errcode='22023',message='user_id_required'; end if;
  return query
  select
    v.user_id,
    p.username::text,
    p.display_name,
    v.identity_status,
    v.identity_submitted_at,
    front_doc.storage_bucket,
    front_doc.storage_path,
    back_doc.storage_bucket,
    back_doc.storage_path,
    v.linkedin_status,
    v.linkedin_profile_url,
    v.linkedin_submitted_at
  from private.member_profile_verifications v
  join public.profiles p on p.id=v.user_id
  left join lateral (
    select d.storage_bucket,d.storage_path
    from private.member_identity_documents d
    where d.user_id=v.user_id and d.document_side='front' and d.status='submitted'
    order by d.submitted_at desc nulls last,d.created_at desc
    limit 1
  ) front_doc on true
  left join lateral (
    select d.storage_bucket,d.storage_path
    from private.member_identity_documents d
    where d.user_id=v.user_id and d.document_side='back' and d.status='submitted'
    order by d.submitted_at desc nulls last,d.created_at desc
    limit 1
  ) back_doc on true
  where v.user_id=p_user_id;
end;
$$;
revoke all on function public.admin_get_member_profile_verification_detail(uuid,uuid) from public,anon,authenticated;
grant execute on function public.admin_get_member_profile_verification_detail(uuid,uuid) to service_role;

comment on function public.admin_list_member_profile_verifications(uuid,integer,integer) is
  'LX-20 trusted moderation queue for pending CCCD and LinkedIn profile verification.';
comment on function public.admin_get_member_profile_verification_detail(uuid,uuid) is
  'LX-20 trusted verification detail including private document locations for short-lived admin signed URLs only.';
