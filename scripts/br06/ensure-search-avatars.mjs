import { createHash, randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

const supabaseUrl = required('BR06_SUPABASE_URL').replace(/\/$/, '');
const serviceRoleKey = required('BR06_SUPABASE_SERVICE_ROLE_KEY');
const outputSql = process.env.BR06_SEARCH_AVATAR_SQL_PATH?.trim() || '/tmp/br06-search-avatars.sql';

const parsedUrl = new URL(supabaseUrl);
if (!['127.0.0.1', 'localhost'].includes(parsedUrl.hostname)) {
  throw new Error('BR-06 search-avatar setup is local-only and refuses non-local Supabase URLs.');
}

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

const profileResponse = await request(
  '/rest/v1/profiles?select=id,username&username=in.(br06_fan,br06_outsider,br06_moderator)',
);
const profiles = await profileResponse.json();
const profileByUsername = new Map(profiles.map((profile) => [profile.username, profile]));
const fan = profileByUsername.get('br06_fan');
const outsider = profileByUsername.get('br06_outsider');
const moderator = profileByUsername.get('br06_moderator');
if (!fan?.id || !outsider?.id || !moderator?.id) {
  throw new Error('BR-06 Fan, Outsider, or moderator profile is missing after base fixture setup.');
}

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2n6sAAAAASUVORK5CYII=',
  'base64',
);

const targets = [
  { key: 'fan', id: fan.id },
  { key: 'outsider', id: outsider.id },
].map((target) => {
  const mediaId = randomUUID();
  return {
    ...target,
    mediaId,
    storagePath: `${target.id}/${mediaId}/br06-search-avatar.png`,
    sha256: createHash('sha256').update(tinyPng).update(target.key).digest('hex'),
  };
});

for (const target of targets) {
  await request(`/storage/v1/object/profile-media/${target.storagePath.split('/').map(encodeURIComponent).join('/')}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'image/png',
      'x-upsert': 'false',
    },
    body: tinyPng,
  });
}

const sqlLiteral = (value) => `'${String(value).replaceAll("'", "''")}'`;
const uuidLiteral = (value) => `${sqlLiteral(value)}::uuid`;

const valuesSql = targets.map((target) => `(
  ${uuidLiteral(target.mediaId)},
  ${uuidLiteral(target.id)},
  'profile-media',
  ${sqlLiteral(target.storagePath)},
  'image',
  'image/png',
  ${tinyPng.length},
  1,
  1,
  ${sqlLiteral(target.sha256)},
  'avatar',
  'approved',
  now(),
  now(),
  ${uuidLiteral(moderator.id)}
)`).join(',\n');

const avatarCases = targets.map(
  (target) => `when ${uuidLiteral(target.id)} then ${uuidLiteral(target.mediaId)}`,
).join('\n    ');
const targetIds = targets.map((target) => uuidLiteral(target.id)).join(', ');

const sql = `begin;

-- BR-06 Search expects Viewer to discover Creator, Fan and Outsider. The production
-- discovery contract requires every listed member to have a current approved avatar.
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
${valuesSql};

update public.profiles
set avatar_media_id = case id
    ${avatarCases}
  end
where id in (${targetIds});

commit;
`;

await writeFile(outputSql, sql, 'utf8');
console.warn(`BR-06 approved Search avatars prepared for ${targets.length} isolated profiles.`);
console.warn(`Search-avatar SQL written to ${outputSql}.`);
