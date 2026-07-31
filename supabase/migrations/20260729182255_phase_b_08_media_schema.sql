-- MyFan Phase B / Session 8
-- Moderated user media, albums, private Storage and short-lived access authorization.

create type public.media_type as enum ('image');
create type public.media_visibility as enum ('avatar','public','fan','private','kyc');
create type public.media_moderation_status as enum ('pending_upload','pending_review','approved','rejected','quarantined','deleted');
create type public.album_type as enum ('public','fan');
create type public.moderation_source as enum ('upload','user_report','automated_scan','admin_review','appeal');
create type public.moderation_case_status as enum ('open','queued','in_review','resolved','dismissed');
create type public.moderation_priority as enum ('low','normal','high','urgent');
create type public.moderation_decision as enum ('approve','reject','quarantine','restore','delete');

create table public.media_assets (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  storage_bucket text not null,
  storage_path text not null,
  media_type public.media_type not null default 'image',
  mime_type text not null,
  file_size_bytes bigint not null,
  width integer,
  height integer,
  sha256 text,
  visibility public.media_visibility not null,
  moderation_status public.media_moderation_status not null default 'pending_upload',
  moderation_reason_code text,
  uploaded_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  rejected_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint media_assets_bucket_check check (storage_bucket in ('pending-media','profile-media','kyc-private')),
  constraint media_assets_path_check check (storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[a-z0-9][a-z0-9._-]{0,127}$'),
  constraint media_assets_mime_check check (mime_type in ('image/jpeg','image/png','image/webp','application/pdf')),
  constraint media_assets_size_check check (file_size_bytes > 0 and file_size_bytes <= 15728640),
  constraint media_assets_dimension_check check ((width is null and height is null) or (width between 1 and 12000 and height between 1 and 12000)),
  constraint media_assets_sha256_check check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  constraint media_assets_kyc_bucket_check check ((visibility='kyc' and storage_bucket='kyc-private') or visibility<>'kyc'),
  constraint media_assets_user_media_bucket_check check ((visibility='kyc') or storage_bucket in ('pending-media','profile-media')),
  constraint media_assets_approved_location_check check (moderation_status<>'approved' or storage_bucket='profile-media'),
  constraint media_assets_status_timestamps_check check (
    (moderation_status='approved' and approved_at is not null and approved_by is not null and rejected_at is null and deleted_at is null)
    or (moderation_status='rejected' and rejected_at is not null and approved_at is null and deleted_at is null)
    or (moderation_status='deleted' and deleted_at is not null)
    or moderation_status in ('pending_upload','pending_review','quarantined')
  ),
  unique(storage_bucket,storage_path)
);
comment on table public.media_assets is 'Metadata for private Storage objects. User-facing assets remain unavailable until moderation_status=approved.';
create index media_assets_owner_status_created_idx on public.media_assets(owner_id,moderation_status,created_at desc);
create index media_assets_visibility_status_created_idx on public.media_assets(visibility,moderation_status,created_at desc) where deleted_at is null;
create index media_assets_moderation_queue_idx on public.media_assets(moderation_status,created_at) where moderation_status in ('pending_review','quarantined');
create index media_assets_approved_by_idx on public.media_assets(approved_by,approved_at) where approved_by is not null;
create trigger media_assets_set_updated_at before update on public.media_assets for each row execute function private.set_updated_at();

create table public.albums (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  album_type public.album_type not null,
  fan_threshold_units bigint not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint albums_name_length check (char_length(btrim(name)) between 1 and 80),
  constraint albums_threshold_nonnegative check (fan_threshold_units>=0),
  constraint albums_public_threshold_zero check ((album_type='public' and fan_threshold_units=0) or album_type='fan')
);
create index albums_owner_type_active_idx on public.albums(owner_id,album_type,is_active,created_at desc) where deleted_at is null;
create trigger albums_set_updated_at before update on public.albums for each row execute function private.set_updated_at();

create table public.album_media (
  album_id uuid not null references public.albums(id) on delete cascade,
  media_id uuid not null references public.media_assets(id) on delete restrict,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key(album_id,media_id),
  constraint album_media_sort_order_nonnegative check (sort_order>=0)
);
create index album_media_media_idx on public.album_media(media_id,album_id);
create index album_media_album_sort_idx on public.album_media(album_id,sort_order,created_at);

create table public.moderation_cases (
  id uuid primary key default extensions.gen_random_uuid(),
  media_id uuid references public.media_assets(id) on delete restrict,
  reported_message_id uuid references public.messages(id) on delete restrict,
  reported_user_id uuid references public.profiles(id) on delete restrict,
  source public.moderation_source not null,
  status public.moderation_case_status not null default 'open',
  priority public.moderation_priority not null default 'normal',
  rule_codes text[] not null default '{}',
  automated_score_json jsonb not null default '{}'::jsonb,
  assigned_to uuid references auth.users(id) on delete set null,
  decision public.moderation_decision,
  decision_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint moderation_cases_one_target check (num_nonnulls(media_id,reported_message_id,reported_user_id)=1),
  constraint moderation_cases_rule_codes_length check (cardinality(rule_codes)<=50),
  constraint moderation_cases_score_object check (jsonb_typeof(automated_score_json)='object'),
  constraint moderation_cases_notes_length check (decision_notes is null or char_length(decision_notes)<=4000),
  constraint moderation_cases_resolution_check check ((status in ('resolved','dismissed') and resolved_at is not null) or (status not in ('resolved','dismissed') and resolved_at is null))
);
create index moderation_cases_queue_idx on public.moderation_cases(status,priority,created_at);
create index moderation_cases_media_idx on public.moderation_cases(media_id,created_at desc) where media_id is not null;
create index moderation_cases_assigned_idx on public.moderation_cases(assigned_to,status) where assigned_to is not null;
create trigger moderation_cases_set_updated_at before update on public.moderation_cases for each row execute function private.set_updated_at();

create table private.media_moderation_events (
  id bigint generated always as identity primary key,
  media_id uuid not null references public.media_assets(id) on delete restrict,
  moderation_case_id uuid references public.moderation_cases(id) on delete set null,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  action public.moderation_decision not null,
  previous_status public.media_moderation_status not null,
  new_status public.media_moderation_status not null,
  reason_code text not null,
  notes text,
  request_id uuid not null default extensions.gen_random_uuid(),
  created_at timestamptz not null default now(),
  constraint media_moderation_events_reason_format check (reason_code~'^[a-z][a-z0-9_]{1,63}$'),
  constraint media_moderation_events_notes_length check (notes is null or char_length(notes)<=4000),
  unique(request_id)
);
comment on table private.media_moderation_events is 'Immutable append-only audit for media moderation actions.';
create index media_moderation_events_media_created_idx on private.media_moderation_events(media_id,created_at desc);
create index media_moderation_events_actor_created_idx on private.media_moderation_events(actor_user_id,created_at desc);

alter table public.profiles add constraint profiles_avatar_media_id_fkey foreign key(avatar_media_id) references public.media_assets(id) on delete set null;
alter table public.reports add constraint reports_target_media_id_fkey foreign key(target_media_id) references public.media_assets(id) on delete restrict;
