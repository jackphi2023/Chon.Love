import { describe, expect, it } from 'vitest';
import {
  normalizeHomepageSettings,
  normalizePublicActivityHighlights,
  normalizePublicFeaturedCreators,
  shouldUseHomepageHeroSlider,
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

  it('keeps the pre-slider settings payload backward-compatible', () => {
    const settings = normalizeHomepageSettings({
      hero_desktop_youtube_url: 'https://www.youtube.com/watch?v=demo123',
      hero_mobile_youtube_url: null,
      section2_left_image_url: null,
      section2_right_image_url: null,
      section3_background_image_url: null,
      section4_image_url: null,
      updated_at: '2026-08-22T11:00:00.000Z',
    });

    expect(settings.hero_slider_images).toEqual([]);
    expect(shouldUseHomepageHeroSlider(settings)).toBe(false);
  });

  it('uses a complete responsive slider in preference to YouTube', () => {
    const settings = normalizeHomepageSettings({
      hero_desktop_youtube_url: 'https://youtu.be/demo123',
      hero_mobile_youtube_url: 'https://youtu.be/demo456',
      hero_slider_images: [{
        id: '00000000-0000-4000-8000-000000000099',
        desktop_url: 'https://cdn.example.com/hero-desktop.webp',
        mobile_url: 'https://cdn.example.com/hero-mobile.webp',
      }],
      section2_left_image_url: null,
      section2_right_image_url: null,
      section3_background_image_url: null,
      section4_image_url: null,
      updated_at: '2026-08-22T11:00:00.000Z',
    });

    expect(shouldUseHomepageHeroSlider(settings)).toBe(true);
    expect(settings.hero_slider_images[0]?.desktop_url).toContain('hero-desktop');
  });

  it('rejects an incomplete or non-HTTPS hero slide', () => {
    const base = {
      hero_desktop_youtube_url: null,
      hero_mobile_youtube_url: null,
      section2_left_image_url: null,
      section2_right_image_url: null,
      section3_background_image_url: null,
      section4_image_url: null,
      updated_at: '2026-08-22T11:00:00.000Z',
    };

    expect(() => normalizeHomepageSettings({
      ...base,
      hero_slider_images: [{
        id: '00000000-0000-4000-8000-000000000099',
        desktop_url: 'http://cdn.example.com/hero.webp',
      }],
    })).toThrow();
  });

  it('normalizes whitespace and truncates long public copy', () => {
    expect(truncatePublicHomepageText('  Một   hoạt động\nđã duyệt  ', 40)).toBe(
      'Một hoạt động đã duyệt',
    );
    expect(truncatePublicHomepageText('a'.repeat(40), 12)).toBe('aaaaaaaaaaa…');
  });
});
