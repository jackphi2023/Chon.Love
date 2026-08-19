import { expect, test } from '@playwright/test';

const password = process.env.BR06_E2E_PASSWORD || 'Br06-local-only-2026!';
const creator = { username: 'br06_creator', displayName: 'BR06 Creator' };
const outsider = { email: 'br06.outsider@example.test' };

async function login(page, expectedSearchTestId) {
  await page.goto('/auth?mode=login');
  await expect(page.getByTestId('luxy-auth-screen')).toBeVisible();
  await page.getByPlaceholder('email@example.com').fill(outsider.email);
  await page.getByPlaceholder('Nhập mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập bằng email' }).click();
  await expect(page.getByTestId(expectedSearchTestId)).toBeVisible({ timeout: 30_000 });
}

async function openCreatorProfile(page) {
  await page.goto(`/profile/${creator.username}`);
  await expect(page.getByTestId('luxy-member-profile-page')).toBeVisible();
  await expect(page.getByRole('heading', { name: new RegExp(`^${creator.displayName},`) })).toBeVisible();
}

async function expectVerificationIconHeight(page, expectedHeight) {
  const badges = page.getByTestId('luxy-member-verification-badges');
  await expect(badges).toBeVisible();

  for (const key of ['selfie', 'identity', 'linkedin']) {
    const icon = badges.locator(`[data-testid^="luxy-verification-icon-${key}-"]`);
    await expect(icon).toHaveCount(1);
    await expect(icon).toBeVisible();
    const box = await icon.boundingBox();
    expect(box, `${key} verification icon should have a rendered box`).not.toBeNull();
    expect(Math.round(box.height), `${key} verification icon rendered height`).toBe(expectedHeight);
  }
}

async function expectCanonicalMembershipArtwork(page) {
  const badge = page.getByTestId('luxy-membership-badge-diamond').first();
  await expect(badge).toBeVisible();
  await expect(badge.locator('svg')).toHaveCount(0);
  await expect(badge.locator('img')).toHaveCount(1);

  const box = await badge.boundingBox();
  expect(box).not.toBeNull();
  // Member Profile intentionally renders the canonical 768x512 artwork at 112px wide.
  expect(Math.round(box.width)).toBe(112);
  expect(Math.round(box.height)).toBe(75);
}

test('desktop Member Profile locks canonical membership artwork and 26px verification icons', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  try {
    await login(page, 'luxy-search-desktop');
    await openCreatorProfile(page);
    await expectCanonicalMembershipArtwork(page);
    await expectVerificationIconHeight(page, 26);
  } finally {
    await context.close();
  }
});

test('mobile Member Profile locks 18px verification icons and canonical membership artwork', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  try {
    await login(page, 'luxy-search-mobile');
    await openCreatorProfile(page);
    await expectCanonicalMembershipArtwork(page);
    await expectVerificationIconHeight(page, 18);
  } finally {
    await context.close();
  }
});
