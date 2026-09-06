import { randomBytes, randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

const supabaseUrl = required('BR06_SUPABASE_URL').replace(/\/$/, '');
const serviceRoleKey = required('BR06_SUPABASE_SERVICE_ROLE_KEY');
const outputSql = process.env.BR06_SEARCH_AVATAR_SQL_PATH?.trim() || '/tmp/br06-search-avatar-fixtures.sql';
const parsedUrl = new URL(supabaseUrl);

if (!['127.0.0.1', 'localhost'].includes(parsedUrl.hostname)) {
  throw new Error('BR-06 search-avatar fixture setup is local-only and refuses non-local Supabase URLs.');
}

const targetEmails = ['br06.fan@example.test', 'br06.outsider@example.test'];
const moderatorEmail = 'br06.moderator@example.test';

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

const usersResponse = await request('/auth/v1/admin/users?page=1&per_page=1000');
const usersPayload = await usersResponse.json();
const users = Array.isArray(usersPayload) ? usersPayload : usersPayload.users;
if (!Array.isArray(users)) throw new Error('Auth Admin response did not include a users array.');

const byEmail = new Map(users.map((user) => [String(user.email ?? '').toLowerCase(), user]));
const moderator = byEmail.get(moderatorEmail);
if (!moderator?.id) throw new Error('BR-06 moderator fixture is missing.');

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2n6sAAAAASUVORK5CYII=',
  'base64',
);

const fixtures = targetEmails.map((email) => {
  const user = byEmail.get(email);
  if (!user?.id) throw new Error(`BR-06 search actor fixture is missing: ${email}`);
  const mediaId = randomUUID();
  return {
    email,
    userId: user.id,
    mediaId,
    storagePath: `${user.id}/${mediaId}/br06-search-avatar.png`,
    sha256: randomBytes(32).toString('hex'),
  };
});

for (const fixture of fixtures) {
  await request(`/storage/v1/object/profile-media/${fixture.storagePath.split('/').map(encodeURIComponent).join('/')}`, {
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
const values = fixtures.map((fixture) => `(
    ${uuidLiteral(fixture.mediaId)},
    ${uuidLiteral(fixture.userId)},
    'profile-media',
    ${sqlLiteral(fixture.storagePath)},
    'image',
    'image/png',
    ${tinyPng.length},
    1,
    1,
    ${sqlLiteral(fixture.sha256)},
    'avatar',
    'approved',
    now(),
    now(),
    ${uuidLiteral(moderator.id)}
  )`).join(',\n  ');
const profileUpdates = fixtures.map((fixture) => `update public.profiles
set avatar_media_id = ${uuidLiteral(fixture.mediaId)}
where id = ${uuidLiteral(fixture.userId)};`).join('\n\n');

const sql = `begin;

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
  ${values};

${profileUpdates}

commit;
`;

await writeFile(outputSql, sql, 'utf8');
console.warn(`BR-06 approved Search avatar fixtures prepared for ${fixtures.length} local actors.`);
console.warn(`Search avatar fixture SQL written to ${outputSql}.`);
