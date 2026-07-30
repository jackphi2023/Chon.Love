import { describe, expect, it } from 'vitest';
import {
  getYouTubeThumbnail,
  normalizeActivityVideoUrl,
  validateActivityComposer,
} from './activity';

describe('creator activity composer', () => {
  it('allows the three V1 post shapes', () => {
    expect(validateActivityComposer({ body: 'Bài chỉ có chữ' })).toBe('text');
    expect(validateActivityComposer({ body: 'Bài có ảnh', mediaId: crypto.randomUUID() })).toBe('image');
    expect(
      validateActivityComposer({
        body: 'Bài có video',
        externalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      }),
    ).toBe('video');
  });

  it('rejects image and video in the same post', () => {
    expect(() =>
      validateActivityComposer({
        body: 'Không hợp lệ',
        mediaId: crypto.randomUUID(),
        externalUrl: 'https://youtu.be/dQw4w9WgXcQ',
      }),
    ).toThrow('activity_image_and_video_cannot_be_combined');
  });

  it('requires text for every V1 post', () => {
    expect(() => validateActivityComposer({ body: '   ' })).toThrow('invalid_activity_body');
  });

  it('requires a gift only when one image is gift locked', () => {
    const mediaId = crypto.randomUUID();
    expect(() =>
      validateActivityComposer({ body: 'Ảnh khóa', mediaId, imageAccessMode: 'gift_locked' }),
    ).toThrow('activity_required_gift_missing');
    expect(
      validateActivityComposer({
        body: 'Ảnh khóa',
        mediaId,
        imageAccessMode: 'gift_locked',
        requiredGiftId: crypto.randomUUID(),
      }),
    ).toBe('image');
  });
});

describe('activity video allowlist', () => {
  it.each([
    'https://youtu.be/dQw4w9WgXcQ',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=15',
    'https://youtube.com/shorts/dQw4w9WgXcQ',
    'https://youtube.com/embed/dQw4w9WgXcQ',
  ])('normalizes YouTube URL %s', (url) => {
    expect(normalizeActivityVideoUrl(url)).toEqual({
      provider: 'youtube',
      canonicalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      videoId: 'dQw4w9WgXcQ',
    });
  });

  it('normalizes OF.TV without tracking query or fragment', () => {
    expect(normalizeActivityVideoUrl('https://www.of.tv/video/example?utm_source=test#section')).toEqual({
      provider: 'of_tv',
      canonicalUrl: 'https://of.tv/video/example',
      videoId: null,
    });
  });

  it.each([
    'http://youtube.com/watch?v=dQw4w9WgXcQ',
    'https://example.com/video/123',
    'https://localhost/video',
    'https://127.0.0.1/video',
    'https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ',
  ])('rejects non-allowlisted or unsafe URL %s', (url) => {
    expect(() => normalizeActivityVideoUrl(url)).toThrow();
  });

  it('creates only the official YouTube thumbnail host', () => {
    expect(getYouTubeThumbnail('dQw4w9WgXcQ')).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
  });
});
