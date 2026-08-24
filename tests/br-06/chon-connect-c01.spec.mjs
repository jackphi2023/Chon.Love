import { expect, test } from '@playwright/test';

const password = process.env.BR06_E2E_PASSWORD || 'Br06-local-only-2026!';
const actor = { email: 'br06.viewer@example.test' };

async function login(page) {
  await page.goto('/auth?mode=login');
  await expect(page.getByTestId('luxy-auth-screen')).toBeVisible();
  await page.getByLabel('Email', { exact: true }).fill(actor.email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập bằng email' }).click();
  await expect(page.getByTestId('luxy-search-mobile')).toBeVisible({ timeout: 30_000 });
}

async function expectCompactPhotoCount(card) {
  const cardBox = await card.boundingBox();
  const badge = card.getByTestId('chon-photo-count');
  const badgeBox = await badge.boundingBox();
  const iconBox = await badge.getByTestId('chon-photo-count-icon').boundingBox();
  expect(cardBox).not.toBeNull();
  expect(badgeBox).not.toBeNull();
  expect(iconBox).not.toBeNull();
  expect(iconBox.width).toBeGreaterThanOrEqual(7);
  expect(iconBox.width).toBeLessThanOrEqual(9);
  expect(badgeBox.x).toBeGreaterThan(cardBox.x + cardBox.width / 2);
  expect((cardBox.x + cardBox.width) - (badgeBox.x + badgeBox.width)).toBeLessThanOrEqual(12);
  expect(badgeBox.y - cardBox.y).toBeLessThanOrEqual(14);
}

async function expectResultsButton(button) {
  await expect(button).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(button).toHaveCSS('border-color', 'rgb(255, 187, 0)');
  await button.hover();
  await expect(button).toHaveCSS('background-color', 'rgb(255, 187, 0)');
  await expect(button).not.toHaveCSS('box-shadow', 'none');
}

test('UI-C01/C02 keeps shared Connect cards compact, branded and consistent across mobile and desktop', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  try {
    await login(page);

    const mobileCreator = page.getByTestId('luxy-search-mobile-card').filter({ hasText: 'BR06 Creator' }).first();
    await expect(mobileCreator).toBeVisible();
    await expect(mobileCreator.getByTestId('chon-connect-member-photo')).toBeVisible();
    const mobileBadge = mobileCreator.getByTestId('luxy-membership-badge-diamond');
    await expect(mobileBadge).toBeVisible();
    const mobileBadgeBox = await mobileBadge.boundingBox();
    expect(mobileBadgeBox).not.toBeNull();
    expect(Math.abs(mobileBadgeBox.width - 16)).toBeLessThanOrEqual(1);

    await expectCompactPhotoCount(mobileCreator);
    const mobileOverlayBox = await mobileCreator.getByTestId('chon-connect-card-info-overlay').boundingBox();
    expect(mobileOverlayBox).not.toBeNull();
    expect(mobileOverlayBox.height).toBeLessThanOrEqual(61);

    const favorite = mobileCreator.getByRole('button', { name: /^Yêu thích BR06 Creator/ });
    await favorite.click();
    await expect(favorite).toHaveCSS('background-color', 'rgb(217, 45, 42)');
    await expect(favorite).toHaveAttribute('aria-selected', 'true');
    await favorite.click();
    await expect(favorite).not.toHaveCSS('background-color', 'rgb(217, 45, 42)');

    await page.getByTestId('luxy-search-mobile-filter-button').click();
    const mobileResults = page.getByTestId('luxy-search-mobile-filter-apply');
    await expectResultsButton(mobileResults);
    await testInfo.attach('ui-c01-mobile-connect', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
    await mobileResults.click();

    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.getByTestId('luxy-search-desktop')).toBeVisible();
    const desktopCreator = page.getByTestId('luxy-search-member-card').filter({ hasText: 'BR06 Creator' }).first();
    await expect(desktopCreator).toBeVisible();
    await expect(desktopCreator.getByTestId('chon-connect-member-photo')).toBeVisible();
    const desktopBadge = desktopCreator.getByTestId('luxy-membership-badge-diamond');
    const desktopBadgeBox = await desktopBadge.boundingBox();
    expect(desktopBadgeBox).not.toBeNull();
    expect(Math.abs(desktopBadgeBox.width - 26)).toBeLessThanOrEqual(1);

    await expectCompactPhotoCount(desktopCreator);
    const desktopOverlayBox = await desktopCreator.getByTestId('chon-connect-card-info-overlay').boundingBox();
    expect(desktopOverlayBox).not.toBeNull();
    expect(desktopOverlayBox.height).toBeLessThanOrEqual(63);

    const desktopResults = page.getByRole('button', { name: 'Xem kết quả', exact: true }).first();
    await expectResultsButton(desktopResults);
    await testInfo.attach('ui-c01-desktop-connect', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  } finally {
    await context.close();
  }
});
