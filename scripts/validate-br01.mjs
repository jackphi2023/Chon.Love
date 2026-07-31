import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();

const requiredFiles = [
  'supabase/migrations/20260731100320_seed_16_beta_users_support.sql',
  'supabase/migrations/20260731100850_enable_pg_net_for_seed_transport.sql',
  'supabase/migrations/20260731100951_temporary_seed_asset_transport.sql',
  'supabase/migrations/20260731101606_temporary_seed_image_transport.sql',
  'supabase/migrations/20260731103048_temporary_seed_user_manifest.sql',
  'supabase/migrations/20260731103426_temporary_seed_request_helper.sql',
  'supabase/migrations/20260731103608_cleanup_one_time_beta_seed_transport.sql',
  'supabase/migrations/20260731114823_br_01_explicit_rpc_only_deny_policies.sql',
  'supabase/functions/seed-myfan-beta-users/index.ts',
  'supabase/functions/reset-myfan-beta-passwords/index.ts',
];

const errors = [];

for (const relativePath of requiredFiles) {
  if (!existsSync(resolve(root, relativePath))) {
    errors.push(`Missing BR-01 source-of-truth file: ${relativePath}`);
  }
}

const tombstones = [
  {
    path: 'supabase/functions/seed-myfan-beta-users/index.ts',
    marker: 'seed_endpoint_disabled',
  },
  {
    path: 'supabase/functions/reset-myfan-beta-passwords/index.ts',
    marker: 'reset_endpoint_disabled',
  },
];

const forbiddenPatterns = [
  /ONE_TIME_TOKEN/i,
  /NEW_PASSWORD/i,
  /SUPABASE_SERVICE_ROLE_KEY/i,
  /SUPABASE_SECRET_KEYS/i,
  /auth\.admin/i,
  /updateUserById/i,
  /listUsers/i,
  /signInWithPassword/i,
  /searchParams\.get\(["']token["']\)/i,
];

for (const tombstone of tombstones) {
  const absolutePath = resolve(root, tombstone.path);
  if (!existsSync(absolutePath)) continue;
  const source = readFileSync(absolutePath, 'utf8');

  if (!source.includes(tombstone.marker)) {
    errors.push(`${tombstone.path} must remain a disabled HTTP 410 tombstone.`);
  }
  if (!source.includes('status: 410')) {
    errors.push(`${tombstone.path} must return HTTP 410.`);
  }

  for (const pattern of forbiddenPatterns) {
    if (pattern.test(source)) {
      errors.push(`${tombstone.path} contains forbidden privileged bootstrap logic: ${pattern}`);
    }
  }
}

const cleanupPath = resolve(
  root,
  'supabase/migrations/20260731103608_cleanup_one_time_beta_seed_transport.sql',
);
if (existsSync(cleanupPath)) {
  const cleanup = readFileSync(cleanupPath, 'utf8');
  if (!cleanup.includes('drop extension if exists pg_net')) {
    errors.push('Historical cleanup migration must remove pg_net if present.');
  }
}

const denyPolicyPath = resolve(
  root,
  'supabase/migrations/20260731114823_br_01_explicit_rpc_only_deny_policies.sql',
);
if (existsSync(denyPolicyPath)) {
  const migration = readFileSync(denyPolicyPath, 'utf8');
  const requiredPolicies = [
    'creator_posts_deny_direct_client_access',
    'creator_post_media_deny_direct_client_access',
    'creator_post_unlocks_deny_direct_client_access',
    'creator_post_unlock_events_deny_direct_client_access',
    'message_user_hides_deny_direct_client_access',
    'vietqr_payment_orders_deny_direct_client_access',
  ];
  for (const policy of requiredPolicies) {
    if (!migration.includes(policy)) errors.push(`Missing explicit RPC-only policy: ${policy}`);
  }
}

if (errors.length > 0) {
  console.error('BR-01 validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.warn('BR-01 source security validation passed.');
