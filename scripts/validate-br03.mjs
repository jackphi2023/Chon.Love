import { readFileSync } from 'node:fs';

const readText = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const readJson = (path) => JSON.parse(readText(path));

const errors = [];
const expect = (condition, message) => {
  if (!condition) errors.push(message);
};

const packageJson = readJson('package.json');
const ciWorkflow = readText('.github/workflows/ci.yml');
const databaseWorkflow = readText('.github/workflows/database.yml');
const authSource = readText('apps/mobile/src/lib/auth.ts');
const providerSource = readText('apps/mobile/src/providers/auth-provider.tsx');
const loginSource = readText('apps/mobile/app/(auth)/index.tsx');
const callbackSource = readText('apps/mobile/app/auth/callback.tsx');
const forgotSource = readText('apps/mobile/app/auth/forgot-password.tsx');
const resetSource = readText('apps/mobile/app/auth/reset-password.tsx');

expect(authSource.includes('signInWithPassword'), 'BR-03 must implement email/password sign-in.');
expect(authSource.includes('resetPasswordForEmail'), 'BR-03 must implement password recovery email.');
expect(authSource.includes("signOut({ scope: 'global' })"), 'Password reset must revoke all sessions.');
expect(authSource.includes("'local' | 'global' | 'others'"), 'BR-03 must preserve all Supabase sign-out scopes.');
expect(authSource.includes('CONTROLLED_BETA_EMAIL'), 'BR-03 must preserve the controlled Beta credential exception.');
expect(providerSource.includes('client.auth.getUser()'), 'Restored sessions must be validated with Auth getUser().');
expect(providerSource.includes("scope: AuthSignOutScope = 'global'"), 'Default application sign-out must be global.');
expect(loginSource.includes('Đăng nhập bằng email'), 'The Beta login screen must expose email/password sign-in.');
expect(loginSource.includes('/auth/forgot-password'), 'The login screen must link to recovery.');
expect(callbackSource.includes('getSafeAuthCallbackDestination'), 'Auth callbacks must allowlist recovery destinations.');
expect(forgotSource.includes('requestPasswordReset'), 'The recovery request screen must call the Auth helper.');
expect(resetSource.includes('updateCurrentPassword'), 'The reset screen must complete password update.');

const authFiles = [authSource, providerSource, loginSource, callbackSource, forgotSource, resetSource];
for (const [index, source] of authFiles.entries()) {
  expect(
    !/password\s*:\s*['"][^'"]{4,}['"]/iu.test(source),
    `Auth source file ${index + 1} must not contain a hard-coded password literal.`,
  );
  expect(!/service[_-]?role/iu.test(source), `Auth source file ${index + 1} must not reference service-role credentials.`);
}

const migrationPaths = [
  'supabase/migrations/20260731134111_br_03_beta_auth_rotation_and_session_controls.sql',
  'supabase/migrations/20260731134449_br_03_beta_fixed_credentials_exception.sql',
  'supabase/migrations/20260731134617_br_03_remove_rotation_scaffolding.sql',
];
for (const path of migrationPaths) {
  const source = readText(path);
  expect(
    !/\b(create|alter|insert|update|delete|drop|grant|revoke)\b[\s\S]*;/iu.test(source),
    `${path} must remain an inert reconciliation record.`,
  );
  expect(!/encrypted_password|refresh_token|access_token/iu.test(source), `${path} must not contain Auth secrets or hashes.`);
}

expect(
  packageJson.scripts?.['validate:auth'] === 'node scripts/validate-br03.mjs',
  'package.json must expose validate:auth.',
);
expect(
  packageJson.scripts?.validate?.includes('validate:auth'),
  'The aggregate validate command must include BR-03 auth validation.',
);
expect(ciWorkflow.includes('pnpm validate:auth'), 'Application CI must execute BR-03 auth validation.');
expect(
  databaseWorkflow.includes('br_03_auth_session_reconciliation.sql'),
  'Database CI must execute the BR-03 reconciliation contract.',
);

for (const path of [
  'docs/br-03/README.md',
  'docs/br-03/AUTH-SESSION-DESIGN.md',
  'docs/br-03/BETA-CREDENTIAL-POLICY.md',
  'docs/br-03/ACCEPTANCE.md',
  'docs/br-03/STATUS.md',
]) {
  try {
    readText(path);
  } catch {
    errors.push(`Missing required BR-03 document: ${path}`);
  }
}

if (errors.length > 0) {
  console.error('BR-03 auth/session validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.warn('BR-03 auth/session validation passed.');
console.warn('Email/password, recovery callback, fixed Beta credential policy, and global session revocation are present.');
