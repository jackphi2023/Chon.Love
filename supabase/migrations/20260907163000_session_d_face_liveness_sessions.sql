begin;

create table if not exists private.member_face_liveness_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  aws_session_id uuid not null unique,
  client_request_token text not null unique,
  region text not null,
  state text not null default 'created'
    check (state in ('created', 'completed', 'failed', 'expired')),
  aws_status text,
  confidence numeric(5,2)
    check (confidence is null or (confidence >= 0 and confidence <= 100)),
  threshold numeric(5,2) not null
    check (threshold >= 0 and threshold <= 100),
  challenge_type text not null
    check (challenge_type in ('FaceMovementAndLightChallenge', 'FaceMovementChallenge')),
  reference_image_sha256 text
    check (reference_image_sha256 is null or reference_image_sha256 ~ '^[0-9a-f]{64}$'),
  reference_image_stored boolean not null default false,
  error_code text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint member_face_liveness_expiry_check check (expires_at > created_at),
  constraint member_face_liveness_completion_check check (
    (state = 'completed' and completed_at is not null)
    or (state <> 'completed')
  )
);

create index if not exists member_face_liveness_sessions_user_created_idx
  on private.member_face_liveness_sessions (user_id, created_at desc);

create index if not exists member_face_liveness_sessions_active_idx
  on private.member_face_liveness_sessions (user_id, expires_at desc)
  where state = 'created';

revoke all on table private.member_face_liveness_sessions from anon, authenticated;

comment on table private.member_face_liveness_sessions is
  'Server-only binding between a Chon.Love member and a single-use AWS Rekognition Face Liveness session. Raw liveness video and AWS credentials are never stored here.';
comment on column private.member_face_liveness_sessions.aws_session_id is
  'Single-use AWS Face Liveness session id. AWS expires liveness session data after three minutes.';
comment on column private.member_face_liveness_sessions.confidence is
  'Server-side audit value only. Do not return this score to member clients.';
comment on column private.member_face_liveness_sessions.reference_image_sha256 is
  'SHA-256 binding for the AWS liveness ReferenceImage. Prevents a client from reusing a valid liveness session with different face bytes.';

commit;
