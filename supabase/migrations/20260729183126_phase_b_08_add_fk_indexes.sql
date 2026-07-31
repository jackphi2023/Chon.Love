create index if not exists media_moderation_events_case_idx on private.media_moderation_events(moderation_case_id) where moderation_case_id is not null;
create index if not exists moderation_cases_reported_message_idx on public.moderation_cases(reported_message_id) where reported_message_id is not null;
create index if not exists moderation_cases_reported_user_idx on public.moderation_cases(reported_user_id) where reported_user_id is not null;
create index if not exists profiles_avatar_media_idx on public.profiles(avatar_media_id) where avatar_media_id is not null;
create index if not exists reports_target_media_idx on public.reports(target_media_id) where target_media_id is not null;
