import { describe, expect, it } from 'vitest';
import {
  homepageThumbnailUrl,
  normalizeHomepageSettings,
  optimizePublicHomepageSettings,
} from './homepage';

const homepageObjectUrl =
  'https://asnydvqsduonyidjyyzq.supabase.co/storage/v1/object/public/homepage-public/demo/homepage/image.png';

describe('homepage thumbnails', () => {
  it('uses the exact same homepage object through the Storage render endpoint', () => {
    expect(homepageThumbnailUrl(homepageObjectUrl, 900, 80)).toBe(
      'https://asnydvqsduonyidjyyzq.supabase.co/storage/v1/render/image/public/homepage-public/demo/homepage/image.png?width=900&quality=80',
    );
  });

  it('never rewrites profile or third-party image URLs', () => {
    const profileImage =
      'https://asnydvqsduonyidjyyzq.supabase.co/storage/v1/object/public/profile-media/user/avatar.png';
    const externalImage = 'https://cdn.example.com/original.png';

    expect(homepageThumbnailUrl(profileImage, 900)).toBe(profileImage);
    expect(homepageThumbnailUrl(externalImage, 900)).toBe(externalImage);
  });

  it('optimizes public homepage delivery without changing the stored image identity', () => {
    const settings = normalizeHomepageSettings({
      hero_desktop_youtube_url: null,
      hero_mobile_youtube_url: null,
      hero_slider_images: [{
        id: '00000000-0000-4000-8000-000000000099',
        desktop_url: homepageObjectUrl,
        mobile_url: homepageObjectUrl.replace('image.png', 'image-mobile.png'),
      }],
      section2_left_image_url: homepageObjectUrl.replace('image.png', 'section2-left.png'),
      section2_right_image_url: null,
      section3_background_image_url: homepageObjectUrl.replace('image.png', 'section3.png'),
      section4_image_url: homepageObjectUrl.replace('image.png', 'section4.png'),
      updated_at: '2026-08-27T08:00:00.000Z',
    });

    const optimized = optimizePublicHomepageSettings(settings);

    expect(optimized.hero_slider_images[0]?.desktop_url).toContain('/demo/homepage/image.png?');
    expect(optimized.hero_slider_images[0]?.mobile_url).toContain('/demo/homepage/image-mobile.png?');
    expect(optimized.section2_left_image_url).toContain('/demo/homepage/section2-left.png?');
    expect(optimized.section3_background_image_url).toContain('/demo/homepage/section3.png?');
    expect(optimized.section4_image_url).toContain('/demo/homepage/section4.png?');
  });
});
