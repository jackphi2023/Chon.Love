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

async function expectImageSize(locator, expectedSize, label) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, `${label} should have a rendered box`).not.toBeNull();
  expect(Math.round(box.width), `${label} width`).toBe(expectedSize);
  expect(Math.round(box.height), `${label} height`).toBe(expectedSize);
}

async function expectNavigationIconSize(page, expectedSize) {
  for (const label of ['Kết nối', 'Yêu thích', 'Tin nhắn']) {
    const button = page.getByRole('button', { name: label, exact: true });
    await expect(button).toHaveCount(1);
    await expectImageSize(button.locator('img').first(), expectedSize, `${label} navigation icon`);
  }
}

async function expectVerificationIconHeight(page, expectedHeight) {
  const badges = page.getByTestId('luxy-member-verification-badges');
  await expect(badges).toBeVisible();
  for (const key of ['selfie', 'identity', 'linkedin']) {
    const icon = badges.locator(`[data-testid^="luxy-verification-icon-${key}-"]`);
    await expect(icon).toHaveCount(1);
    const box = await icon.boundingBox();
    expect(box).not.toBeNull();
    expect(Math.round(box.height), `${key} verification icon height`).toBe(expectedHeight);
  }
}

async function expectProfileFactIconSize(page, expectedSize) {
  for (const [testId, label] of [
    ['luxy-profile-fact-recent', 'recent'],
    ['luxy-profile-fact-location', 'location'],
    ['luxy-profile-fact-member-since', 'profile'],
  ]) {
    await expectImageSize(page.getByTestId(testId).locator('img').first(), expectedSize, `${label} profile icon`);
  }
}

async function expectCanonicalMembershipArtwork(page, expectedWidth) {
  const badge = page.locator('[data-testid="luxy-membership-badge-diamond"]:visible');
  await expect(badge).toHaveCount(1);
  await expect(badge.locator('svg')).toHaveCount(0);
  await expect(badge.locator('img')).toHaveCount(1);
  const box = await badge.boundingBox();
  expect(box).not.toBeNull();
  expect(Math.round(box.width)).toBe(expectedWidth);
  expect(Math.round(box.height)).toBe(Math.round((expectedWidth * 2) / 3));
}

test('desktop locks canonical 26px brand icons and large membership artwork', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  try {
    await login(page, 'luxy-search-desktop');
    await expectNavigationIconSize(page, 26);
    await openCreatorProfile(page);
    await expectCanonicalMembershipArtwork(page, 160);
    await expectVerificationIconHeight(page, 26);
    await expectProfileFactIconSize(page, 26);
  } finally {
    await context.close();
  }
});

test('mobile locks canonical 18px brand icons and large membership artwork', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  try {
    await login(page, 'luxy-search-mobile');
    await expectNavigationIconSize(page, 18);
    await openCreatorProfile(page);
    await expectCanonicalMembershipArtwork(page, 132);
    await expectVerificationIconHeight(page, 18);
    await expectProfileFactIconSize(page, 18);
  } finally {
    await context.close();
  }
});
