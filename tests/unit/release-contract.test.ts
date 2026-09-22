import { appendFileSync, cpSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { requiredEdgeFunctions, validateReleaseContract } from '../../scripts/validate-release-contract.mjs';

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'chon-release-contract-'));
  for (const path of ['config/releases', 'supabase/migrations', 'supabase/config.toml', 'packages/supabase/src/database.types.ts',
    ...requiredEdgeFunctions.map((name: string) => `supabase/functions/${name}`)]) {
    cpSync(path, join(root, path), { recursive: true });
  }
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('reviewed release contract guard', () => {
  it('accepts the complete reviewed repository snapshot', () => {
    expect(validateReleaseContract(root).migrations.count).toBe(160);
  });

  it('detects a migration timestamp drift even when SQL content is unchanged', () => {
    renameSync(join(root, 'supabase/migrations/20260922141628_opt_09_gift_transactions_realtime_publication.sql'),
      join(root, 'supabase/migrations/20260922120000_opt_09_gift_transactions_realtime_publication.sql'));
    expect(() => validateReleaseContract(root)).toThrow('Migration inventory differs');
  });

  it('detects an Edge source change that has no new hosted parity record', () => {
    appendFileSync(join(root, 'supabase/functions/media-moderation/index.ts'), '\nthrow new Error("unreviewed change");\n');
    expect(() => validateReleaseContract(root)).toThrow('media-moderation: source changed');
  });

  it('detects accidental removal of moderation JWT verification', () => {
    const path = join(root, 'supabase/config.toml');
    writeFileSync(path, readFileSync(path, 'utf8').replace('[functions.media-moderation]\nverify_jwt = true', '[functions.media-moderation]\nverify_jwt = false'));
    expect(() => validateReleaseContract(root)).toThrow('media-moderation: JWT configuration differs');
  });
});
