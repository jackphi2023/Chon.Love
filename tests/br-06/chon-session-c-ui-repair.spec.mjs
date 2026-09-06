import { expect, test } from '@playwright/test';

const password = process.env.BR06_E2E_PASSWORD || 'Br06-local-only-2026!';
const actor = { email: 'br06.viewer@example.test' };
const HERO_DESKTOP = 'https://cdn.example.test/session-c-hero-desktop.png';
const HERO_MOBILE = 'https://cdn.example.test/session-c-hero-mobile.png';
const CACHE_KEY = 'chon.homepage.hero.v1';
const BADGE_INSET_RENDER_TOLERANCE_PX = 2.5;
const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z1ioAAAAASUVORK5CYII=',
  'base64',
);

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

async function assertNoHorizontalOverflow(page) {
  const metrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
}

async function login(page) {
  await page.goto('/auth?mode=login');
  await expect(page.getByTestId('luxy-auth-screen')).toBeVisible();
  await page.getByLabel('Email', { exact: true }).fill(actor.email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập bằng email' }).click();
  await expect(page.getByTestId('luxy-search-mobile')).toBeVisible({ timeout: 30_000 });
}

async function expectTopLeftBadge(frame, badge, expectedHeight, expectedInset) {
  const frameBox = await frame.boundingBox();
  const badgeBox = await badge.boundingBox();
  expect(frameBox).not.toBeNull();
  expect(badgeBox).not.toBeNull();
  expect(Math.abs(badgeBox.height - expectedHeight)).toBeLessThanOrEqual(1);

  const leftInset = badgeBox.x - frameBox.x;
  const topInset = badgeBox.y - frameBox.y;
  expect(leftInset).toBeGreaterThanOrEqual(expectedInset - BADGE_INSET_RENDER_TOLERANCE_PX);
  expect(leftInset).toBeLessThanOrEqual(expectedInset + BADGE_INSET_RENDER_TOLERANCE_PX);
  expect(topInset).toBeGreaterThanOrEqual(expectedInset - BADGE_INSET_RENDER_TOLERANCE_PX);
  expect(topInset).toBeLessThanOrEqual(expectedInset + BADGE_INSET_RENDER_TOLERANCE_PX);
  expect(badgeBox.x).toBeLessThan(frameBox.x + frameBox.width / 2);
  expect(badgeBox.y).toBeLessThan(frameBox.y + frameBox.height / 2);
}

test('Session C hero switches to the mobile asset at both 390px and 430px without layout overflow', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.addInitScript(({ cacheKey, desktopUrl, mobileUrl }) => {
    localStorage.setItem(cacheKey, JSON.stringify({
      savedAt: Date.now(),
      slides: [{
        id: '22222222-2222-4222-8222-222222222222',
        desktop_url: desktopUrl,
        mobile_url: mobileUrl,
      }],
      desktopUrl: null,
      mobileUrl: null,
    }));
  }, { cacheKey: CACHE_KEY, desktopUrl: HERO_DESKTOP, mobileUrl: HERO_MOBILE });

  const settingsGate = deferred();
  await page.route('**/rest/v1/rpc/get_public_homepage_settings', async (route) => {
    await settingsGate.promise;
    await route.continue();
  });
  await page.route('https://cdn.example.test/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: ONE_PIXEL_PNG,
      headers: { 'cache-control': 'public, max-age=31536000, immutable' },
    });
  });

  try {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const slider = page.getByTestId('chon-homepage-hero-slider');
    const image = slider.getByTestId('chon-homepage-hero-slide-image');
    await expect(slider).toBeVisible({ timeout: 2_000 });
    await expect(image).toHaveAttribute('src', HERO_DESKTOP);
    await expect(image).toHaveAttribute('loading', 'eager');
    await expect(image).toHaveAttribute('fetchpriority', 'high');

    for (const width of [390, 430]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 932 });
      await expect(image).toHaveAttribute('src', HERO_MOBILE);
      const sliderBox = await slider.boundingBox();
      const fallbackBox = await slider.getByTestId('chon-homepage-hero-fallback-image').boundingBox();
      expect(sliderBox).not.toBeNull();
      expect(fallbackBox).not.toBeNull();
      expect(Math.abs(sliderBox.width - fallbackBox.width)).toBeLessThanOrEqual(1);
      expect(Math.abs(sliderBox.height - fallbackBox.height)).toBeLessThanOrEqual(1);
      await assertNoHorizontalOverflow(page);
    }
  } finally {
    settingsGate.resolve();
  }
});

test('Session C keeps the Profile Premium/Diamond artwork large and consistently anchored top-left', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  try {
    await login(page);
    await page.goto('/profile/br06_creator');
    await expect(page).toHaveURL(/\/thanh-vien\/id-[a-z0-9-]+/i, { timeout: 20_000 });
    await expect(page.getByTestId('chon-member-profile-page')).toBeVisible();

    const heroMedia = page.getByTestId('chon-member-profile-hero-media');
    const badge = heroMedia.getByTestId('chon-membership-badge-diamond');
    await expect(heroMedia).toBeVisible();
    await expect(badge).toBeVisible();
    await expectTopLeftBadge(heroMedia, badge, 91, 10);

    await page.setViewportSize({ width: 1280, height: 900 });
    await expectTopLeftBadge(heroMedia, badge, 110, 10);
    await assertNoHorizontalOverflow(page);
  } finally {
    await context.close();
  }
});
