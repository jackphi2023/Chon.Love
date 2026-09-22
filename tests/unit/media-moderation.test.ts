import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

// Exercise the deployed handler source with mocked Supabase I/O. No production
// accounts, storage objects or moderation decisions are changed by these tests.
const source = readFileSync('supabase/functions/media-moderation/index.ts', 'utf8')
  .replace(/^import .+;\r?\n/gmu, '');
const javascript = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const mediaId = '00000000-0000-4000-8000-000000000001';
const ownerId = '00000000-0000-4000-8000-000000000002';
const media = {
  id: mediaId, owner_id: ownerId, storage_bucket: 'pending-media',
  storage_path: `${ownerId}/private.jpg`, mime_type: 'image/jpeg',
  moderation_status: 'pending_review', visibility: 'avatar',
  created_at: '2026-09-22T08:00:00Z', uploaded_at: '2026-09-22T08:01:00Z',
  updated_at: '2026-09-22T08:01:00Z', deleted_at: null,
};

function fixture(options: {
  authenticated?: boolean; moderator?: boolean; queueError?: boolean;
  previewError?: boolean; empty?: boolean; approved?: boolean;
} = {}) {
  const calls: { table: string; method: string; args: unknown[] }[] = [];
  const signedUrl = vi.fn(async () => options.previewError
    ? { data: null, error: new Error('storage unavailable') }
    : { data: { signedUrl: 'https://storage.example/signed-preview' }, error: null });
  const from = vi.fn((table: string) => {
    let selection = '';
    const result = () => {
      if (table === 'profiles') return { data: [{ id: ownerId, username: 123456, display_name: 'Fixture Member' }], error: null };
      if (table === 'moderation_cases') return { data: [
        { id: 'latest-case', media_id: mediaId, status: 'open', priority: 'high', rule_codes: ['profile_edit'], created_at: '2026-09-22T08:02:00Z' },
        { id: 'older-case', media_id: mediaId, status: 'closed', priority: 'normal', rule_codes: [], created_at: '2026-09-21T08:02:00Z' },
      ], error: null };
      if (selection === 'owner_id') return { data: [{ owner_id: ownerId }], error: null };
      return { data: options.empty ? [] : [media], count: options.empty ? 0 : 51, error: options.queueError ? new Error('database unavailable') : null };
    };
    const query = {
      select(...args: unknown[]) { selection = String(args[0]); calls.push({ table, method: 'select', args }); return query; },
      eq(...args: unknown[]) { calls.push({ table, method: 'eq', args }); return query; },
      in(...args: unknown[]) { calls.push({ table, method: 'in', args }); return query; },
      is(...args: unknown[]) { calls.push({ table, method: 'is', args }); return query; },
      order(...args: unknown[]) { calls.push({ table, method: 'order', args }); return query; },
      range(...args: unknown[]) { calls.push({ table, method: 'range', args }); return query; },
      maybeSingle: async () => ({ data: { ...media, moderation_status: options.approved ? 'approved' : media.moderation_status }, error: null }),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve),
    };
    return query;
  });
  const rpc = vi.fn(async () => ({ data: options.moderator !== false, error: null }));
  const userClient = {
    auth: { getUser: vi.fn(async () => ({ data: { user: options.authenticated === false ? null : { id: ownerId } }, error: null })) }, rpc,
  };
  const adminClient = {
    from,
    auth: { admin: { getUserById: vi.fn(async () => ({ data: { user: { email: 'fixture@example.test' } }, error: null })) } },
    storage: { from: vi.fn(() => ({ createSignedUrl: signedUrl })) },
  };
  const createClient = vi.fn((_url: string, key: string) => key === 'public-fixture' ? userClient : adminClient);
  let handler: (request: Request) => Promise<Response> = async () => { throw new Error('Deno.serve not registered'); };
  runInNewContext(javascript, {
    createClient, Request, Response, crypto,
    Deno: {
      env: { get: (name: string) => ({ SUPABASE_URL: 'https://fixture.supabase.co', SUPABASE_ANON_KEY: 'public-fixture', SUPABASE_SERVICE_ROLE_KEY: 'private-fixture' })[name] },
      serve: (callback: typeof handler) => { handler = callback; },
    },
  });
  const request = (body: unknown = { action: 'list' }, authorization = 'Bearer fixture-token') => handler(new Request('https://fixture.test/media-moderation', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(authorization ? { Authorization: authorization } : {}) }, body: JSON.stringify(body),
  }));
  return { request, handler, calls, from, rpc, signedUrl, createClient };
}

describe('media-moderation deployed handler', () => {
  it('requires authentication before creating clients or reading private media', async () => {
    const f = fixture();
    expect((await f.request({ action: 'list' }, '')).status).toBe(401);
    expect(f.createClient).not.toHaveBeenCalled();
  });

  it('rejects invalid sessions before queue reads', async () => {
    const f = fixture({ authenticated: false });
    expect((await f.request()).status).toBe(401);
    expect(f.from).not.toHaveBeenCalled();
    expect(f.rpc).not.toHaveBeenCalled();
  });

  it('rejects ordinary members before service-role reads and signed URLs', async () => {
    const f = fixture({ moderator: false });
    expect((await f.request()).status).toBe(403);
    expect(f.from).not.toHaveBeenCalled();
    expect(f.signedUrl).not.toHaveBeenCalled();
  });

  it('lists newest uploads with owner details, latest case and five-minute previews', async () => {
    const f = fixture();
    const response = await f.request();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    const body = await response.json();
    expect(body).toMatchObject({ total_count: 51, limit: 50, offset: 0, moderation_status: 'pending_review' });
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({
      media_id: mediaId, owner_username: '123456', owner_display_name: 'Fixture Member',
      owner_email: 'fixture@example.test', case_id: 'latest-case', priority: 'high',
      preview_url: 'https://storage.example/signed-preview', preview_expires_in_seconds: 300,
      is_replacement: true, review_alert: 'User mới sửa ảnh cần duyệt',
    });
    expect(body.items[0]).not.toHaveProperty('storage_path');
    expect(body.items[0]).not.toHaveProperty('storage_bucket');
    expect(f.signedUrl).toHaveBeenCalledWith(media.storage_path, 300);
    expect(f.calls.filter((c) => c.table === 'media_assets' && c.method === 'order').map((c) => c.args)).toEqual([
      ['uploaded_at', { ascending: false }], ['created_at', { ascending: false }],
    ]);
    expect(f.calls).toContainEqual({ table: 'media_assets', method: 'range', args: [0, 49] });
  });

  it('bounds pagination and defaults unknown statuses to the pending queue', async () => {
    const f = fixture();
    const body = await (await f.request({ action: 'list', limit: 999, offset: -10, moderationStatus: 'unsafe' })).json();
    expect(body).toMatchObject({ limit: 50, offset: 0, moderation_status: 'pending_review' });
  });

  it('allows an empty queue without unnecessary lookups or signing', async () => {
    const f = fixture({ empty: true });
    expect(await (await f.request()).json()).toMatchObject({ items: [], total_count: 0 });
    expect(f.from).toHaveBeenCalledTimes(1);
    expect(f.signedUrl).not.toHaveBeenCalled();
  });

  it('retains usable queue details when a preview is unavailable', async () => {
    const f = fixture({ previewError: true });
    const response = await f.request();
    expect(response.status).toBe(200);
    expect((await response.json()).items[0].preview_url).toBeNull();
  });

  it('reports a failed queue query instead of pretending the queue is empty', async () => {
    const f = fixture({ queueError: true });
    const response = await f.request();
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'media_queue_unavailable' });
    expect(f.signedUrl).not.toHaveBeenCalled();
  });

  it('keeps approve idempotent for an already approved image', async () => {
    const f = fixture({ approved: true });
    const response = await f.request({ action: 'approve', mediaId, reasonCode: 'reviewed' });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ mediaId, moderationStatus: 'approved' });
    expect(f.rpc).toHaveBeenCalledTimes(1); // authorization only; no second moderation
  });

  it('handles CORS preflight without authentication', async () => {
    const f = fixture();
    const response = await f.handler(new Request('https://fixture.test', { method: 'OPTIONS' }));
    expect(response.status).toBe(200);
    expect(f.createClient).not.toHaveBeenCalled();
  });
});
