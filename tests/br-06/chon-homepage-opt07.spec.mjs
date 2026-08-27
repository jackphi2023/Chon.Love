import { expect, test } from '@playwright/test';

const CACHE_KEY = 'chon.homepage.hero.v1';
const HERO_DESKTOP = 'https://cdn.example.test/chon-hero-desktop.png';
const HERO_MOBILE = 'https://cdn.example.test/chon-hero-mobile.png';
const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z1ioAAAAASUVORK5CYII=',
  'base64',
);

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test('OPT-07 warm cache renders priority hero before settings RPC and keeps a local fallback underneath', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.addInitScript(({ cacheKey, desktopUrl, mobileUrl }) => {
    localStorage.setItem(cacheKey, JSON.stringify({
      savedAt: Date.now(),
      slides: [{
        id: '11111111-1111-4111-8111-111111111111',
        desktop_url: desktopUrl,
        mobile_url: mobileUrl,
      }],
      desktopUrl: null,
      mobileUrl: null,
    }));
  }, { cacheKey: CACHE_KEY, desktopUrl: HERO_DESKTOP, mobileUrl: HERO_MOBILE });

  const settingsGate = deferred();
  const imageGate = deferred();
  let settingsRequestStarted = false;

  await page.route('**/rest/v1/rpc/get_public_homepage_settings', async (route) => {
    settingsRequestStarted = true;
    await settingsGate.promise;
    await route.continue();
  });
  await page.route('https://cdn.example.test/**', async (route) => {
    await imageGate.promise;
    await route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: ONE_PIXEL_PNG,
      headers: { 'cache-control': 'public, max-age=31536000, immutable' },
    });
  });

  try {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect.poll(() => settingsRequestStarted, { timeout: 2_000 }).toBe(true);

    const slider = page.getByTestId('chon-homepage-hero-slider');
    await expect(slider).toBeVisible({ timeout: 1_500 });

    const fallback = slider.getByTestId('chon-homepage-hero-fallback-image');
    await expect(fallback).toBeVisible();

    const priorityImage = slider.getByTestId('chon-homepage-hero-slide-image');
    await expect(priorityImage).toHaveAttribute('loading', 'eager');
    await expect(priorityImage).toHaveAttribute('fetchpriority', 'high');
    await expect(priorityImage).toHaveAttribute('src', HERO_DESKTOP);
    expect(await priorityImage.evaluate((image) => image instanceof HTMLImageElement && image.naturalWidth > 0)).toBe(false);

    // The configured network hero is deliberately blocked here. The bundled fallback
    // must already occupy the slider, proving cold/warm transitions never expose a
    // transparent hero while settings or media are still in flight.
    const fallbackBox = await fallback.boundingBox();
    const sliderBox = await slider.boundingBox();
    expect(fallbackBox).not.toBeNull();
    expect(sliderBox).not.toBeNull();
    expect(Math.abs(fallbackBox.width - sliderBox.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(fallbackBox.height - sliderBox.height)).toBeLessThanOrEqual(1);

    imageGate.resolve();
    await expect.poll(
      () => priorityImage.evaluate((image) => image instanceof HTMLImageElement && image.naturalWidth > 0),
      { timeout: 2_000 },
    ).toBe(true);
  } finally {
    imageGate.resolve();
    settingsGate.resolve();
  }
});
