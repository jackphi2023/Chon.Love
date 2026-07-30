alter table public.reports add column target_creator_post_id uuid references public.creator_posts(id) on delete cascade;
alter table public.reports drop constraint reports_exactly_one_target;
alter table public.reports add constraint reports_exactly_one_target check (num_nonnulls(target_user_id,target_media_id,target_message_id,target_creator_post_id)=1);
create index reports_target_creator_post_idx on public.reports(target_creator_post_id) where target_creator_post_id is not null;

create or replace function private.can_view_creator_activity_preview_object(p_name text,p_viewer uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select exists(select 1 from public.creator_post_media pm join public.creator_posts p on p.id=pm.post_id join public.media_assets m on m.id=pm.media_id join public.creator_profiles cp on cp.user_id=p.creator_id
  where pm.preview_bucket='activity-previews' and pm.preview_path=p_name and pm.preview_status='ready' and p.deleted_at is null and (
    (p_viewer=p.creator_id and private.is_active_adult(p_viewer)) or
    (p_viewer is not null and private.current_user_has_any_role(array['moderator','super_admin']::private.user_role[])) or
    (p.moderation_status='approved' and p.published_at is not null and m.moderation_status='approved' and m.deleted_at is null and cp.creator_status='approved' and cp.approved_at is not null and private.is_active_adult(p.creator_id) and (p_viewer is null or (private.is_active_adult(p_viewer) and not private.users_are_blocked(p_viewer,p.creator_id))))
  ))
$$;

create or replace function private.can_view_creator_activity_original_object(p_bucket text,p_name text,p_viewer uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select exists(select 1 from public.creator_post_media pm join public.creator_posts p on p.id=pm.post_id join public.media_assets m on m.id=pm.media_id join public.creator_profiles cp on cp.user_id=p.creator_id
  left join private.creator_post_unlocks u on u.post_id=p.id and u.viewer_id=p_viewer and u.status='active'
  where m.storage_bucket=p_bucket and m.storage_path=p_name and p.deleted_at is null and (
    (p_viewer=p.creator_id and private.is_active_adult(p_viewer)) or
    (p_viewer is not null and private.current_user_has_any_role(array['moderator','super_admin']::private.user_role[])) or
    (p.moderation_status='approved' and p.published_at is not null and m.moderation_status='approved' and m.deleted_at is null and cp.creator_status='approved' and cp.approved_at is not null and private.is_active_adult(p.creator_id) and (p_viewer is null or (private.is_active_adult(p_viewer) and not private.users_are_blocked(p_viewer,p.creator_id))) and (p.image_access_mode='public' or (p_viewer is not null and u.id is not null)))
  ))
$$;

create or replace function public.send_gift_and_unlock_creator_post(p_post_id uuid,p_idempotency_key uuid)
returns table(gift_transaction_id uuid,post_id uuid,entitlement_status text,sender_balance_units bigint,already_unlocked boolean,already_processed boolean)
language plpgsql security definer set search_path=''
as $$
declare
  v_viewer uuid:=auth.uid(); v_post public.creator_posts; v_gift public.gift_catalog; v_unlock private.creator_post_unlocks;
  v_existing_tx public.gift_transactions; v_result record; v_balance bigint:=0;
begin
  if v_viewer is null then raise exception using errcode='42501',message='authentication_required'; end if;
  if p_idempotency_key is null then raise exception using errcode='22023',message='idempotency_key_required'; end if;
  if not private.is_active_adult(v_viewer) then raise exception using errcode='42501',message='active_adult_viewer_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_viewer::text||':'||p_post_id::text,0));
  select p.* into v_post from public.creator_posts p where p.id=p_post_id and p.moderation_status='approved' and p.published_at is not null and p.deleted_at is null and p.archived_at is null for update;
  if not found or v_post.content_type<>'image' or v_post.image_access_mode<>'gift_locked' or v_post.required_gift_id is null then raise exception using errcode='22023',message='creator_activity_post_not_unlockable'; end if;
  if v_viewer=v_post.creator_id then raise exception using errcode='22023',message='creator_activity_owner_does_not_need_unlock'; end if;
  if private.users_are_blocked(v_viewer,v_post.creator_id) then raise exception using errcode='42501',message='creator_activity_unlock_blocked'; end if;
  if not exists(select 1 from public.creator_profiles cp where cp.user_id=v_post.creator_id and cp.creator_status='approved' and cp.approved_at is not null) or not private.is_active_adult(v_post.creator_id) then raise exception using errcode='42501',message='approved_creator_required'; end if;
  if not exists(select 1 from public.creator_post_media pm join public.media_assets m on m.id=pm.media_id where pm.post_id=v_post.id and pm.preview_status='ready' and m.moderation_status='approved' and m.deleted_at is null) then raise exception using errcode='42501',message='creator_activity_media_not_approved'; end if;

  select u.* into v_unlock from private.creator_post_unlocks u where u.post_id=v_post.id and u.viewer_id=v_viewer for update;
  if found and v_unlock.status='active' then
    select coalesce(ha.available_units,0) into v_balance from private.heart_accounts ha where ha.user_id=v_viewer;
    return query select v_unlock.gift_transaction_id,v_post.id,'active'::text,coalesce(v_balance,0),true,false; return;
  end if;
  select g.* into v_gift from public.gift_catalog g where g.id=v_post.required_gift_id and g.is_active and g.deleted_at is null;
  if not found then raise exception using errcode='22023',message='creator_activity_required_gift_inactive'; end if;
  if v_gift.heart_price_units<>v_post.required_gift_units_snapshot then raise exception using errcode='22023',message='creator_activity_gift_price_changed'; end if;

  select gt.* into v_existing_tx from public.gift_transactions gt where gt.sender_id=v_viewer and gt.idempotency_key=p_idempotency_key;
  if found then
    if v_existing_tx.unlock_target_type<>'creator_post' or v_existing_tx.unlock_target_id<>v_post.id or v_existing_tx.status<>'completed' or v_existing_tx.reversed_heart_units<>0 then raise exception using errcode='23505',message='creator_activity_idempotency_conflict'; end if;
    insert into private.creator_post_unlocks(post_id,viewer_id,creator_id,gift_transaction_id,required_gift_id,gift_units_snapshot,status,unlocked_at,revoked_at,revoke_reason)
    values(v_post.id,v_viewer,v_post.creator_id,v_existing_tx.id,v_post.required_gift_id,v_post.required_gift_units_snapshot,'active',now(),null,null)
    on conflict(post_id,viewer_id) do update set gift_transaction_id=excluded.gift_transaction_id,required_gift_id=excluded.required_gift_id,gift_units_snapshot=excluded.gift_units_snapshot,status='active',unlocked_at=now(),revoked_at=null,revoke_reason=null returning * into v_unlock;
    select coalesce(ha.available_units,0) into v_balance from private.heart_accounts ha where ha.user_id=v_viewer;
    return query select v_existing_tx.id,v_post.id,'active'::text,coalesce(v_balance,0),false,true; return;
  end if;

  select * into v_result from public.send_gift(v_post.creator_id,v_post.required_gift_id,1,p_idempotency_key,null,null);
  update public.gift_transactions set unlock_target_type='creator_post',unlock_target_id=v_post.id where id=v_result.gift_transaction_id returning * into v_existing_tx;
  insert into private.creator_post_unlocks(post_id,viewer_id,creator_id,gift_transaction_id,required_gift_id,gift_units_snapshot,status,unlocked_at,revoked_at,revoke_reason)
  values(v_post.id,v_viewer,v_post.creator_id,v_existing_tx.id,v_post.required_gift_id,v_post.required_gift_units_snapshot,'active',now(),null,null)
  on conflict(post_id,viewer_id) do update set gift_transaction_id=excluded.gift_transaction_id,required_gift_id=excluded.required_gift_id,gift_units_snapshot=excluded.gift_units_snapshot,status='active',unlocked_at=now(),revoked_at=null,revoke_reason=null returning * into v_unlock;
  insert into private.creator_post_unlock_events(unlock_id,post_id,viewer_id,gift_transaction_id,event_type,metadata_json)
  values(v_unlock.id,v_post.id,v_viewer,v_existing_tx.id,case when v_unlock.created_at=v_unlock.updated_at then 'unlocked' else 'reactivated' end,jsonb_build_object('gift_id',v_post.required_gift_id,'gift_units',v_post.required_gift_units_snapshot));
  return query select v_existing_tx.id,v_post.id,'active'::text,v_result.sender_balance_units,false,v_result.already_processed;
end;
$$;

create or replace function private.sync_creator_post_unlock_from_gift()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_unlock private.creator_post_unlocks; v_status private.creator_activity_unlock_status; v_event text;
begin
  if new.unlock_target_type<>'creator_post' or new.unlock_target_id is null then return new; end if;
  if new.status='reversed' or new.reversed_heart_units>=new.gross_heart_units then v_status:='refunded';v_event:='refunded';
  elsif new.status='partially_reversed' or new.reversed_heart_units>0 then v_status:='fraud_hold';v_event:='fraud_hold'; else return new; end if;
  update private.creator_post_unlocks set status=v_status,revoked_at=coalesce(revoked_at,now()),revoke_reason='gift_'||v_status::text where gift_transaction_id=new.id and status='active' returning * into v_unlock;
  if v_unlock.id is not null then insert into private.creator_post_unlock_events(unlock_id,post_id,viewer_id,gift_transaction_id,event_type,metadata_json) values(v_unlock.id,v_unlock.post_id,v_unlock.viewer_id,new.id,v_event,jsonb_build_object('gift_status',new.status,'reversed_heart_units',new.reversed_heart_units)); end if;
  return new;
end;
$$;
drop trigger if exists gift_transaction_sync_creator_post_unlock on public.gift_transactions;
create trigger gift_transaction_sync_creator_post_unlock after update of status,reversed_heart_units on public.gift_transactions for each row when(new.unlock_target_type='creator_post') execute function private.sync_creator_post_unlock_from_gift();

create or replace function public.report_creator_activity(p_post_id uuid,p_media_id uuid default null,p_target_kind text default 'post',p_reason_code text default 'other',p_description text default null)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_reporter uuid:=auth.uid();v_post public.creator_posts;v_report_id uuid;
begin
  if v_reporter is null or not private.is_active_adult(v_reporter) then raise exception using errcode='42501',message='active_adult_reporter_required'; end if;
  if p_target_kind not in ('post','image','external_link') then raise exception using errcode='22023',message='invalid_activity_report_target'; end if;
  if p_reason_code is null or p_reason_code!~'^[a-z][a-z0-9_]{1,63}$' then raise exception using errcode='22023',message='invalid_report_reason'; end if;
  if p_description is not null and char_length(p_description)>1000 then raise exception using errcode='22023',message='report_description_too_long'; end if;
  select p.* into v_post from public.creator_posts p where p.id=p_post_id and p.moderation_status='approved' and p.deleted_at is null;
  if not found or v_post.creator_id=v_reporter or private.users_are_blocked(v_reporter,v_post.creator_id) then raise exception using errcode='42501',message='activity_report_target_not_available'; end if;
  if p_target_kind='image' then
    if p_media_id is null or not exists(select 1 from public.creator_post_media pm where pm.post_id=v_post.id and pm.media_id=p_media_id) then raise exception using errcode='22023',message='activity_report_media_mismatch'; end if;
  elsif p_media_id is not null then raise exception using errcode='22023',message='activity_report_media_not_expected'; end if;
  if p_target_kind='external_link' and v_post.content_type<>'video' then raise exception using errcode='22023',message='activity_report_link_not_available'; end if;
  if exists(select 1 from public.reports r where r.reporter_id=v_reporter and ((p_target_kind='image' and r.target_media_id=p_media_id) or (p_target_kind<>'image' and r.target_creator_post_id=v_post.id)) and r.created_at>now()-interval '60 seconds') then raise exception using errcode='42901',message='report_rate_limited'; end if;
  insert into public.reports(reporter_id,target_media_id,target_creator_post_id,reason_code,description,evidence_json)
  values(v_reporter,case when p_target_kind='image' then p_media_id end,case when p_target_kind<>'image' then v_post.id end,p_reason_code,nullif(btrim(p_description),''),jsonb_build_object('creator_post_id',v_post.id,'target_kind',p_target_kind,'external_provider',v_post.external_provider)) returning id into v_report_id;
  return v_report_id;
end;
$$;

create or replace function public.list_creator_activity_moderation_queue(p_limit integer default 30,p_offset integer default 0)
returns table(post_id uuid,creator_id uuid,username text,display_name text,body text,content_type text,external_url text,external_provider text,image_access_mode text,required_gift_name_vi text,required_gift_hearts integer,moderation_status text,submitted_at timestamptz,media_id uuid,preview_bucket text,preview_path text,original_bucket text,original_path text,media_moderation_status text,unlock_count bigint,report_count bigint)
language plpgsql stable security definer set search_path=''
as $$
begin
  if auth.uid() is null or not private.current_user_has_any_role(array['moderator','super_admin']::private.user_role[]) then raise exception using errcode='42501',message='moderator_role_required'; end if;
  return query select p.id,p.creator_id,pr.username,coalesce(pr.display_name,pr.username),p.body,p.content_type::text,p.external_url,p.external_provider,p.image_access_mode::text,g.name_vi,g.display_hearts,p.moderation_status::text,p.submitted_at,pm.media_id,pm.preview_bucket,pm.preview_path,m.storage_bucket,m.storage_path,m.moderation_status::text,
  (select count(*) from private.creator_post_unlocks u where u.post_id=p.id and u.status='active'),(select count(*) from public.reports r where r.target_creator_post_id=p.id or r.target_media_id=pm.media_id)
  from public.creator_posts p join public.profiles pr on pr.id=p.creator_id left join public.creator_post_media pm on pm.post_id=p.id left join public.media_assets m on m.id=pm.media_id left join public.gift_catalog g on g.id=p.required_gift_id
  where p.deleted_at is null and p.moderation_status in ('pending_review','rejected') order by case when p.moderation_status='pending_review' then 0 else 1 end,p.submitted_at,p.id limit least(greatest(coalesce(p_limit,30),1),100) offset greatest(coalesce(p_offset,0),0);
end;
$$;

create or replace function public.moderate_creator_activity_post(p_post_id uuid,p_action text,p_reason_code text,p_notes text default null,p_request_id uuid default null)
returns public.creator_posts language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid();v_before public.creator_posts;v_after public.creator_posts;v_role private.user_role;
begin
  if v_actor is null or not private.current_user_has_any_role(array['moderator','super_admin']::private.user_role[]) then raise exception using errcode='42501',message='moderator_role_required'; end if;
  if p_action not in ('approve','reject') then raise exception using errcode='22023',message='invalid_activity_moderation_action'; end if;
  if p_reason_code is null or p_reason_code!~'^[a-z][a-z0-9_]{1,63}$' then raise exception using errcode='22023',message='invalid_moderation_reason'; end if;
  select p.* into v_before from public.creator_posts p where p.id=p_post_id and p.deleted_at is null for update;
  if not found then raise exception using errcode='23503',message='creator_activity_post_not_found'; end if;
  if p_action='approve' then
    if not exists(select 1 from public.creator_profiles cp where cp.user_id=v_before.creator_id and cp.creator_status='approved' and cp.approved_at is not null) or not private.is_active_adult(v_before.creator_id) then raise exception using errcode='42501',message='approved_creator_required'; end if;
    if v_before.content_type='image' and not exists(select 1 from public.creator_post_media pm join public.media_assets m on m.id=pm.media_id where pm.post_id=v_before.id and pm.preview_status='ready' and m.moderation_status='approved' and m.deleted_at is null) then raise exception using errcode='22023',message='activity_image_and_preview_must_be_approved'; end if;
    if v_before.image_access_mode='gift_locked' and not exists(select 1 from public.gift_catalog g where g.id=v_before.required_gift_id and g.is_active and g.deleted_at is null and g.heart_price_units=v_before.required_gift_units_snapshot) then raise exception using errcode='22023',message='activity_required_gift_not_publishable'; end if;
    update public.creator_posts set moderation_status='approved',moderation_reason_code=p_reason_code,published_at=coalesce(published_at,now()),archived_at=null where id=v_before.id returning * into v_after;
  else update public.creator_posts set moderation_status='rejected',moderation_reason_code=p_reason_code,published_at=null where id=v_before.id returning * into v_after; end if;
  select ur.role into v_role from private.user_roles ur where ur.user_id=v_actor and ur.revoked_at is null and ur.role in ('moderator','super_admin') order by case ur.role when 'super_admin' then 0 else 1 end limit 1;
  insert into private.admin_audit_logs(actor_user_id,actor_role,action,target_type,target_id,before_json,after_json,reason,request_id)
  values(v_actor,v_role,'creator_activity_'||p_action,'creator_post',v_before.id,to_jsonb(v_before),to_jsonb(v_after),concat_ws(': ',p_reason_code,p_notes),coalesce(p_request_id,extensions.gen_random_uuid()));
  return v_after;
end;
$$;

revoke all on function public.send_gift_and_unlock_creator_post(uuid,uuid),public.report_creator_activity(uuid,uuid,text,text,text),public.list_creator_activity_moderation_queue(integer,integer),public.moderate_creator_activity_post(uuid,text,text,text,uuid) from public;
grant execute on function public.send_gift_and_unlock_creator_post(uuid,uuid),public.report_creator_activity(uuid,uuid,text,text,text),public.list_creator_activity_moderation_queue(integer,integer),public.moderate_creator_activity_post(uuid,text,text,text,uuid) to authenticated,service_role;
