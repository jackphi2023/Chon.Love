import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

const supabaseUrl = required('BR06_SUPABASE_URL').replace(/\/$/, '');
const serviceRoleKey = required('BR06_SUPABASE_SERVICE_ROLE_KEY');
const outputSql = process.env.BR06_FIXTURE_SQL_PATH?.trim() || '/tmp/br06-fixtures.sql';
const password = process.env.BR06_E2E_PASSWORD?.trim() || 'Br06-local-only-2026!';

const parsedUrl = new URL(supabaseUrl);
if (!['127.0.0.1', 'localhost'].includes(parsedUrl.hostname)) {
  throw new Error('BR-06 fixture setup is local-only and refuses non-local Supabase URLs.');
}

const actors = [
  { key: 'creator', email: 'br06.creator@example.test', username: 'br06_creator', displayName: 'BR06 Creator' },
  { key: 'viewer', email: 'br06.viewer@example.test', username: 'br06_viewer', displayName: 'BR06 Viewer' },
  { key: 'fan', email: 'br06.fan@example.test', username: 'br06_fan', displayName: 'BR06 Fan' },
  { key: 'outsider', email: 'br06.outsider@example.test', username: 'br06_outsider', displayName: 'BR06 Outsider' },
  { key: 'moderator', email: 'br06.moderator@example.test', username: 'br06_moderator', displayName: 'BR06 Moderator' },
];

async function request(path, options = {}) {
  const response = await fetch(`${supabaseUrl}${path}`, {
    ...options,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      ...(options.headers ?? {}),
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${options.method ?? 'GET'} ${path} failed (${response.status}): ${body}`);
  }
  return response;
}

async function createActor(actor) {
  const response = await request('/auth/v1/admin/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: actor.email,
      password,
      email_confirm: true,
      user_metadata: { br06_actor: actor.key },
    }),
  });
  const payload = await response.json();
  const id = payload.id ?? payload.user?.id;
  if (typeof id !== 'string') throw new Error(`Auth Admin response did not include an id for ${actor.key}.`);
  return { ...actor, id };
}

const created = [];
for (const actor of actors) created.push(await createActor(actor));

const actorByKey = Object.fromEntries(created.map((actor) => [actor.key, actor]));
const creator = actorByKey.creator;
const viewer = actorByKey.viewer;
const fan = actorByKey.fan;
const outsider = actorByKey.outsider;
const moderator = actorByKey.moderator;
if (!creator || !viewer || !fan || !outsider || !moderator) {
  throw new Error('BR-06 Creator, Viewer, Fan, Outsider, or moderator fixture was not created.');
}

const activityMediaId = randomUUID();
const avatarMediaId = randomUUID();
const publicMediaId = randomUUID();
const privatePhotoMediaId = randomUUID();
const publicAlbumId = randomUUID();
const postId = randomUUID();
const activityMediaPath = `${creator.id}/${activityMediaId}/br06-activity.png`;
const avatarMediaPath = `${creator.id}/${avatarMediaId}/br06-avatar.png`;
const publicMediaPath = `${creator.id}/${publicMediaId}/br06-public-profile.png`;
const privatePhotoMediaPath = `${creator.id}/${privatePhotoMediaId}/br06-private-profile.png`;
const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2n6sAAAAASUVORK5CYII=',
  'base64',
);

async function uploadFixtureImage(path) {
  await request(`/storage/v1/object/profile-media/${path.split('/').map(encodeURIComponent).join('/')}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'image/png',
      'x-upsert': 'false',
    },
    body: tinyPng,
  });
}

await uploadFixtureImage(activityMediaPath);
await uploadFixtureImage(avatarMediaPath);
await uploadFixtureImage(publicMediaPath);
await uploadFixtureImage(privatePhotoMediaPath);

const sqlLiteral = (value) => `'${String(value).replaceAll("'", "''")}'`;
const uuidLiteral = (value) => `${sqlLiteral(value)}::uuid`;
const actorIds = created.map((actor) => uuidLiteral(actor.id)).join(',');
const profileCases = created.map((actor) => `when ${uuidLiteral(actor.id)} then ${sqlLiteral(actor.username)}`).join('\n    ');
const displayCases = created.map((actor) => `when ${uuidLiteral(actor.id)} then ${sqlLiteral(actor.displayName)}`).join('\n    ');

const sql = `begin;

update private.user_identity
set
  date_of_birth = (current_date - interval '25 years')::date,
  age_verified_at = now(),
  age_verification_method = 'self_declared',
  terms_version = (select value_json #>> '{}' from private.app_config where key = 'terms_version_current'),
  terms_accepted_at = now(),
  community_rules_version = (select value_json #>> '{}' from private.app_config where key = 'community_rules_version_current'),
  community_rules_accepted_at = now(),
  account_status = 'active'
where user_id in (${actorIds});

update public.profiles
set
  profile_status = 'active',
  discovery_enabled = true,
  nearby_enabled = false,
  province_id = 1,
  last_active_at = now(),
  username = case id
    ${profileCases}
  end,
  display_name = case id
    ${displayCases}
  end,
  bio = 'BR-06 local browser E2E fixture',
  interests = array['Creator', 'Community']::text[]
where id in (${actorIds});

update public.profiles
set
  gender = 'male',
  interested_in = 'female',
  headline = 'Kết nối có chủ đích, sống tích cực và tôn trọng.',
  height_cm = 178,
  weight_kg = 74,
  relationship_status = 'single',
  children_status = 'no_children',
  smoking_status = 'never',
  drinking_status = 'socially',
  education_level = 'bachelors',
  occupation = 'Founder',
  looking_for = 'Một người đồng hành chân thành, độc lập và cùng yêu trải nghiệm mới.',
  lifestyle_tags = array['fine_dining','ready_to_travel','long_term']::public.profile_lifestyle_tag[],
  languages = array['Tiếng Việt','English']::text[]
where id = ${uuidLiteral(creator.id)};

-- Keep the Connect badge fixture valid under the real mutual-interest search contract:
-- the female viewer can discover the male creator, and the creator accepts female profiles.
update public.profiles
set
  gender = 'female',
  interested_in = 'male'
where id = ${uuidLiteral(viewer.id)};

insert into private.user_roles(user_id, role, granted_by)
values (${uuidLiteral(moderator.id)}, 'moderator', ${uuidLiteral(moderator.id)});

update public.profiles
set is_creator = true
where id = ${uuidLiteral(creator.id)};

insert into public.creator_profiles(
  user_id,
  creator_status,
  creator_bio,
  fan_threshold_units,
  approved_at,
  activity_visibility
) values (
  ${uuidLiteral(creator.id)},
  'approved',
  'BR-06 Creator Activity browser fixture',
  1000,
  now(),
  'public'
)
on conflict (user_id) do update
set
  creator_status = excluded.creator_status,
  creator_bio = excluded.creator_bio,
  fan_threshold_units = excluded.fan_threshold_units,
  approved_at = excluded.approved_at,
  activity_visibility = excluded.activity_visibility,
  suspended_at = null;

insert into private.luxy_memberships(user_id, tier, status, messaging_enabled, starts_at, expires_at, source)
values
  (${uuidLiteral(creator.id)}, 'diamond', 'active', true, now() - interval '1 day', now() + interval '30 days', 'br06_fixture'),
  (${uuidLiteral(viewer.id)}, 'premium', 'active', true, now() - interval '1 day', now() + interval '30 days', 'br06_fixture')
on conflict (user_id) do update
set
  tier = excluded.tier,
  status = excluded.status,
  messaging_enabled = excluded.messaging_enabled,
  starts_at = excluded.starts_at,
  expires_at = excluded.expires_at,
  source = excluded.source,
  updated_at = now();

insert into public.media_assets(
  id,
  owner_id,
  storage_bucket,
  storage_path,
  media_type,
  mime_type,
  file_size_bytes,
  width,
  height,
  sha256,
  visibility,
  moderation_status,
  uploaded_at,
  approved_at,
  approved_by
) values
  (
    ${uuidLiteral(activityMediaId)},
    ${uuidLiteral(creator.id)},
    'profile-media',
    ${sqlLiteral(activityMediaPath)},
    'image',
    'image/png',
    ${tinyPng.length},
    1,
    1,
    repeat('d', 64),
    'private',
    'approved',
    now(),
    now(),
    ${uuidLiteral(moderator.id)}
  ),
  (
    ${uuidLiteral(avatarMediaId)},
    ${uuidLiteral(creator.id)},
    'profile-media',
    ${sqlLiteral(avatarMediaPath)},
    'image',
    'image/png',
    ${tinyPng.length},
    1,
    1,
    repeat('e', 64),
    'avatar',
    'approved',
    now(),
    now(),
    ${uuidLiteral(moderator.id)}
  ),
  (
    ${uuidLiteral(publicMediaId)},
    ${uuidLiteral(creator.id)},
    'profile-media',
    ${sqlLiteral(publicMediaPath)},
    'image',
    'image/png',
    ${tinyPng.length},
    1,
    1,
    repeat('f', 64),
    'public',
    'approved',
    now(),
    now(),
    ${uuidLiteral(moderator.id)}
  ),
  (
    ${uuidLiteral(privatePhotoMediaId)},
    ${uuidLiteral(creator.id)},
    'profile-media',
    ${sqlLiteral(privatePhotoMediaPath)},
    'image',
    'image/png',
    ${tinyPng.length},
    1,
    1,
    repeat('a', 64),
    'private',
    'approved',
    now(),
    now(),
    ${uuidLiteral(moderator.id)}
  );

update public.profiles
set avatar_media_id = ${uuidLiteral(avatarMediaId)}
where id = ${uuidLiteral(creator.id)};

insert into public.albums(id, owner_id, name, album_type, fan_threshold_units, is_active)
values (${uuidLiteral(publicAlbumId)}, ${uuidLiteral(creator.id)}, 'Ảnh công khai', 'public', 0, true);

insert into public.album_media(album_id, media_id, sort_order)
values (${uuidLiteral(publicAlbumId)}, ${uuidLiteral(publicMediaId)}, 0);

insert into public.creator_posts(
  id,
  creator_id,
  body,
  content_type,
  image_access_mode,
  moderation_status,
  moderation_reason_code,
  published_at
) values (
  ${uuidLiteral(postId)},
  ${uuidLiteral(creator.id)},
  'BR06 approved Activity image',
  'image',
  'public',
  'approved',
  'br06_fixture',
  now()
);

insert into public.creator_post_media(post_id, media_id)
values (${uuidLiteral(postId)}, ${uuidLiteral(activityMediaId)});

insert into public.fan_progress(
  creator_id,
  fan_user_id,
  lifetime_supported_units,
  eligible_units,
  threshold_units
) values (
  ${uuidLiteral(creator.id)},
  ${uuidLiteral(fan.id)},
  1000,
  1000,
  1000
)
on conflict (creator_id, fan_user_id) do update
set
  lifetime_supported_units = excluded.lifetime_supported_units,
  eligible_units = excluded.eligible_units,
  threshold_units = excluded.threshold_units;

insert into public.fan_memberships(creator_id, fan_user_id, achieved_at, status, revoked_at)
values (${uuidLiteral(creator.id)}, ${uuidLiteral(fan.id)}, now(), 'active', null)
on conflict (creator_id, fan_user_id) do update
set status = 'active', achieved_at = excluded.achieved_at, revoked_at = null;

commit;
`;

await writeFile(outputSql, sql, 'utf8');
await writeFile('/tmp/br06-fixture-manifest.json', JSON.stringify({
  supabaseUrl,
  actors: Object.fromEntries(created.map((actor) => [actor.key, {
    email: actor.email,
    username: actor.username,
    displayName: actor.displayName,
  }])),
  activityMediaId,
  avatarMediaId,
  publicMediaId,
  privatePhotoMediaId,
  publicAlbumId,
  postId,
}, null, 2), 'utf8');

console.warn(`BR-06 local fixtures prepared for ${created.length} isolated accounts and four browser actors.`);
console.warn(`Fixture SQL written to ${outputSql}.`);
