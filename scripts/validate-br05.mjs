import { readFileSync } from 'node:fs';

const readText = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const readJson = (path) => JSON.parse(readText(path));

const packageJson = readJson('package.json');
const releaseManifest = readJson('config/releases/chon-web-v1.json');
const applicationCi = readText('.github/workflows/ci.yml');
const databaseCi = readText('.github/workflows/database.yml');
const reportPrivacyMigration = readText('supabase/migrations/20260731153859_br_05_creator_activity_report_privacy_guard.sql');
const anonymousFeedMigration = readText('supabase/migrations/20260731160038_br_05_anonymous_public_activity_feed_fix.sql');
const e2e = readText('supabase/tests/br_05_creator_activity_privacy_album_e2e.sql');
const activityClient = readText('packages/supabase/src/activity.ts');
const socialClient = readText('packages/supabase/src/social-safety.ts');

const errors = [];
const expect = (condition, message) => {
  if (!condition) errors.push(message);
};

expect(
  packageJson.scripts?.['validate:creator-e2e:legacy'] === 'node scripts/validate-br05.mjs',
  'package.json must expose BR-05 only as validate:creator-e2e:legacy.',
);
expect(
  packageJson.scripts?.validate?.includes('validate:social-e2e') &&
    !packageJson.scripts?.validate?.includes('validate:creator-e2e'),
  'The active Chon.Love aggregate validation must preserve BR-04 and exclude retired Creator Activity.',
);
expect(
  !applicationCi.includes('pnpm validate:creator-e2e'),
  'Application CI must not restore BR-05 Creator Activity as an active release gate.',
);
expect(
  !databaseCi.includes('Run BR-05 Creator Activity'),
  'Database CI must not restore BR-05 Creator Activity as an active release gate.',
);
expect(e2e.includes('select plan(78);'), 'BR-05 historical pgTAP plan must contain 78 assertions.');
expect(
  ['000000000001', '000000000002', '000000000003', '000000000004', '000000000005']
    .every((suffix) => e2e.includes(`4c000000-0000-0000-0000-${suffix}`)),
  'BR-05 must use five isolated deterministic actors.',
);

for (const operation of [
  'create_creator_activity_post',
  'list_creator_activity',
  'list_creator_activity_album',
  'get_creator_activity_access',
  'get_creator_post_media_access',
  'set_my_creator_activity_visibility',
  'list_public_activity_highlights',
  'list_creator_activity_moderation_queue',
  'moderate_creator_activity_post',
  'report_creator_activity',
  'archive_creator_activity_post',
  'delete_creator_activity_post',
  'create_album',
  'add_media_to_album',
  'list_profile_album_media',
  'set_album_active',
  'remove_media_from_album',
  'send_friend_request',
  'respond_to_friend_request',
  'block_user',
  'unblock_user',
]) {
  expect(e2e.includes(operation), `BR-05 pgTAP contract must exercise ${operation}.`);
}

for (const privacyState of ['public', 'friends', 'fans', 'friend_required', 'fan_required', 'unavailable']) {
  expect(e2e.includes(privacyState), `BR-05 must verify privacy state ${privacyState}.`);
}

expect(e2e.includes('anonymous viewers can read all approved public Activity posts'), 'BR-05 must verify the anonymous public feed path.');
expect(e2e.includes('moderator_role_required'), 'BR-05 must deny moderation to ordinary users.');
expect(e2e.includes('creator_activity_media_access_denied'), 'BR-05 must deny hidden original media access.');
expect(e2e.includes('activity_report_target_not_available'), 'BR-05 must deny reports for hidden Activity content.');
expect(e2e.includes('report_rate_limited'), 'BR-05 must verify duplicate Activity report throttling.');
expect(e2e.includes("status='revoked'"), 'BR-05 must verify Fan membership revocation.');
expect(e2e.includes("moderation_status='archived'"), 'BR-05 must verify archived-post owner visibility.');
expect(e2e.includes("moderation_status='rejected'"), 'BR-05 must verify rejected-post owner visibility.');
expect(e2e.trimEnd().endsWith('rollback;'), 'BR-05 fixtures and mutations must always roll back.');

expect(
  reportPrivacyMigration.includes('not private.can_view_creator_activity(v_post.creator_id, v_reporter)'),
  'BR-05 report migration must authorize reports through Creator Activity privacy.',
);
expect(
  reportPrivacyMigration.includes('p.published_at is not null'),
  'BR-05 report migration must require a published Activity target.',
);
expect(
  reportPrivacyMigration.includes("m.moderation_status = 'approved'"),
  'BR-05 report migration must require approved image media for image reports.',
);
expect(
  anonymousFeedMigration.includes('v_owner := coalesce(v_viewer = v_creator, false);'),
  'BR-05 anonymous feed migration must normalize a null viewer into a non-owner boolean.',
);
expect(
  anonymousFeedMigration.includes('v_allowed := private.can_view_creator_activity(v_creator,v_viewer);'),
  'BR-05 anonymous feed migration must preserve the Creator privacy gate.',
);

expect(activityClient.includes('getCreatorActivityAccess'), 'The shared client must expose historical Creator Activity access checks.');
expect(activityClient.includes('listCreatorActivityAlbum'), 'The shared client must expose the historical Activity-derived album.');
expect(activityClient.includes('reportCreatorActivity'), 'The shared client must expose historical privacy-checked Activity reporting.');
expect(socialClient.includes('blockUser') && socialClient.includes('unblockUser'), 'Shared safety controls must remain connected.');

for (const migration of [reportPrivacyMigration, anonymousFeedMigration]) {
  expect(!migration.includes('service_role'), 'BR-05 migrations must not contain a service-role credential.');
}
expect(!e2e.includes('service_role'), 'BR-05 must not use a service-role credential.');
expect(!e2e.includes('MYFAN_E2E_BETA_PASSWORD'), 'BR-05 must not depend on the controlled Beta password.');

for (const financialOperation of [
  'send_gift(',
  'send_gift_and_unlock_creator_post',
  'request_withdrawal',
  'record_verified_play_purchase',
  'create_vietqr_heart_order',
]) {
  expect(!e2e.includes(financialOperation), `BR-05 must not exercise financial operation ${financialOperation}.`);
}

expect(releaseManifest.financialFeaturesEnabled === false, 'Financial feature flags must remain disabled.');
expect(releaseManifest.mergeAllowed === false, 'Historical BR-05 must not authorize merge automatically.');
expect(releaseManifest.productionDeployAllowed === false, 'Historical BR-05 must not authorize production deployment.');

for (const path of [
  'docs/br-05/README.md',
  'docs/br-05/TEST-MATRIX.md',
  'docs/br-05/ACCEPTANCE.md',
  'docs/br-05/STATUS.md',
]) {
  try {
    readText(path);
  } catch {
    errors.push(`Missing required historical BR-05 document: ${path}`);
  }
}

if (errors.length > 0) {
  console.error('Historical BR-05 Creator Activity regression validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.warn('Historical BR-05 Creator Activity regression source validation passed.');
console.warn('Creator Activity remains retired from Chon.Love Web V1 release gates; this command is audit/regression only.');
