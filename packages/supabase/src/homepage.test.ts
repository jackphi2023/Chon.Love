import { describe, expect, it } from 'vitest';
import {
  normalizePublicActivityHighlights,
  normalizePublicFeaturedCreators,
  truncatePublicHomepageText,
} from './homepage';

const creatorId = '00000000-0000-4000-8000-000000000001';
const postId = '00000000-0000-4000-8000-000000000002';

describe('public homepage data', () => {
  it('accepts only public-safe Creator fields', () => {
    const creators = normalizePublicFeaturedCreators([
      {
        creator_id: creatorId,
        username: 'creator_demo',
        display_name: 'Creator Demo',
        creator_bio: 'Nội dung đã kiểm duyệt.',
        avatar_media_id: null,
        avatar_bucket: null,
        avatar_path: null,
        public_activity_count: 3,
        latest_activity_at: '2026-07-31T08:00:00.000Z',
      },
    ]);

    expect(creators).toHaveLength(1);
    expect(creators[0]?.public_activity_count).toBe(3);
    expect(creators[0]).not.toHaveProperty('email');
    expect(creators[0]).not.toHaveProperty('date_of_birth');
    expect(creators[0]).not.toHaveProperty('location');
  });

  it('rejects unsupported or unmoderated activity shapes at runtime', () => {
    expect(() =>
      normalizePublicActivityHighlights([
        {
          post_id: postId,
          creator_id: creatorId,
          username: 'creator_demo',
          display_name: 'Creator Demo',
          avatar_media_id: null,
          avatar_bucket: null,
          avatar_path: null,
          body: 'Bài thử nghiệm',
          content_type: 'livestream',
          external_url: null,
          external_provider: null,
          external_video_id: null,
          published_at: '2026-07-31T08:00:00.000Z',
          media_id: null,
          media_bucket: null,
          media_path: null,
          media_width: null,
          media_height: null,
        },
      ]),
    ).toThrow();
  });

  it('normalizes whitespace and truncates long public copy', () => {
    expect(truncatePublicHomepageText('  Một   hoạt động\nđã duyệt  ', 40)).toBe(
      'Một hoạt động đã duyệt',
    );
    expect(truncatePublicHomepageText('a'.repeat(40), 12)).toBe('aaaaaaaaaaa…');
  });
});
