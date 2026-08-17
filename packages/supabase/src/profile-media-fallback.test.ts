import { describe, expect, it, vi } from 'vitest';
import { createPublicProfileMediaUrl, PUBLIC_PROFILE_MEDIA_URL_TTL_SECONDS } from './profile-media';

describe('profile media resilient signing', () => {
  it('falls back to one signed URL when the batched signing request fails', async () => {
    const createSignedUrls = vi.fn().mockResolvedValue({
      data: null,
      error: new Error('batch_unavailable'),
    });
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: 'https://example.test/fallback.jpg' },
      error: null,
    });
    const from = vi.fn().mockReturnValue({ createSignedUrls, createSignedUrl });
    const client = { storage: { from } } as unknown as Parameters<typeof createPublicProfileMediaUrl>[0];

    await expect(createPublicProfileMediaUrl(client, {
      storage_bucket: 'profile-media',
      storage_path: 'profiles/member/avatar.jpg',
    })).resolves.toBe('https://example.test/fallback.jpg');

    expect(createSignedUrls).toHaveBeenCalledWith(
      ['profiles/member/avatar.jpg'],
      PUBLIC_PROFILE_MEDIA_URL_TTL_SECONDS,
    );
    expect(createSignedUrl).toHaveBeenCalledWith(
      'profiles/member/avatar.jpg',
      PUBLIC_PROFILE_MEDIA_URL_TTL_SECONDS,
    );
  });

  it('falls back only for paths missing from a partial batch response', async () => {
    const createSignedUrls = vi.fn().mockResolvedValue({
      data: [{ path: 'profiles/member/a.jpg', signedUrl: 'https://example.test/a.jpg' }],
      error: null,
    });
    const createSignedUrl = vi.fn().mockImplementation(async (path: string) => ({
      data: { signedUrl: `https://example.test/${path}` },
      error: null,
    }));
    const from = vi.fn().mockReturnValue({ createSignedUrls, createSignedUrl });
    const client = { storage: { from } } as unknown as Parameters<typeof createPublicProfileMediaUrl>[0];

    const [first, second] = await Promise.all([
      createPublicProfileMediaUrl(client, {
        storage_bucket: 'profile-media',
        storage_path: 'profiles/member/a.jpg',
      }),
      createPublicProfileMediaUrl(client, {
        storage_bucket: 'profile-media',
        storage_path: 'profiles/member/b.jpg',
      }),
    ]);

    expect(first).toBe('https://example.test/a.jpg');
    expect(second).toBe('https://example.test/profiles/member/b.jpg');
    expect(createSignedUrl).toHaveBeenCalledTimes(1);
    expect(createSignedUrl).toHaveBeenCalledWith(
      'profiles/member/b.jpg',
      PUBLIC_PROFILE_MEDIA_URL_TTL_SECONDS,
    );
  });
});
