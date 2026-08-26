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

async function getRenderedImageSource(locator) {
  return locator.evaluate((node) => {
    const image = node instanceof HTMLImageElement ? node : node.querySelector('img');
    if (image instanceof HTMLImageElement) return image.currentSrc || image.getAttribute('src');
    const backgroundImage = getComputedStyle(node).backgroundImage;
    return backgroundImage && backgroundImage !== 'none' ? backgroundImage : null;
  });
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

async function expectMediumTopRightMembershipBadge(photo, badge) {
  const photoBox = await photo.boundingBox();
  const badgeBox = await badge.boundingBox();
  expect(photoBox).not.toBeNull();
  expect(badgeBox).not.toBeNull();
  expect(Math.abs(badgeBox.height - 26)).toBeLessThanOrEqual(1);
  expect(badgeBox.width).toBeLessThan(badgeBox.height);
  const rightInset = (photoBox.x + photoBox.width) - (badgeBox.x + badgeBox.width);
  expect(rightInset).toBeGreaterThanOrEqual(0);
  expect(rightInset).toBeLessThanOrEqual(14);
  expect(badgeBox.y - photoBox.y).toBeGreaterThanOrEqual(0);
  expect(badgeBox.y - photoBox.y).toBeLessThanOrEqual(14);
}

async function expectResultsButton(button) {
  await expect(button).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(button).toHaveCSS('border-color', 'rgb(255, 187, 0)');
  await button.hover();
  await expect(button).toHaveCSS('background-color', 'rgb(255, 187, 0)');
  await expect(button).not.toHaveCSS('box-shadow', 'none');
}

async function normalizeCreatorNotFavorited(card) {
  const saved = card.getByRole('button', { name: /^Bỏ yêu thích BR06 Creator/ });
  if (await saved.count()) {
    await saved.click();
    await expect(card.getByRole('button', { name: /^Yêu thích BR06 Creator/ })).toBeVisible();
  }
}

test('UI-C01/C02 keeps shared Connect cards compact with Medium top-right membership badges across mobile and desktop', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  try {
    await login(page);

    const mobileCreator = page.getByTestId('luxy-search-mobile-card').filter({ hasText: 'BR06 Creator' }).first();
    await expect(mobileCreator).toBeVisible();
    await normalizeCreatorNotFavorited(mobileCreator);
    const mobilePhoto = mobileCreator.getByTestId('chon-connect-member-photo');
    await expect(mobilePhoto).toBeVisible();
    const mobileBadge = mobileCreator.getByTestId('chon-membership-badge-diamond');
    await expect(mobileBadge).toBeVisible();
    await expectMediumTopRightMembershipBadge(mobilePhoto, mobileBadge);
    const mobileBadgeImage = mobileBadge.getByTestId('chon-membership-badge-image-diamond');
    await expect(mobileBadgeImage).toBeVisible();
    const mobileBadgeSource = await getRenderedImageSource(mobileBadgeImage);
    expect(mobileBadgeSource).toBeTruthy();

    await expectCompactPhotoCount(mobileCreator);
    const mobileOverlayBox = await mobileCreator.getByTestId('chon-connect-card-info-overlay').boundingBox();
    expect(mobileOverlayBox).not.toBeNull();
    expect(mobileOverlayBox.height).toBeLessThanOrEqual(61);

    const favorite = mobileCreator.getByRole('button', { name: /^Yêu thích BR06 Creator/ });
    await expect(favorite).toHaveAttribute('aria-pressed', 'false');
    await favorite.click();
    const savedFavorite = mobileCreator.getByRole('button', { name: /^Bỏ yêu thích BR06 Creator/ });
    await expect(savedFavorite).toHaveCSS('background-color', 'rgb(233, 74, 71)');
    await expect(savedFavorite).toHaveAttribute('aria-pressed', 'true');
    await savedFavorite.click();
    const unsavedFavorite = mobileCreator.getByRole('button', { name: /^Yêu thích BR06 Creator/ });
    await expect(unsavedFavorite).not.toHaveCSS('background-color', 'rgb(217, 45, 42)');
    await expect(unsavedFavorite).toHaveAttribute('aria-pressed', 'false');

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
    const desktopPhoto = desktopCreator.getByTestId('chon-connect-member-photo');
    await expect(desktopPhoto).toBeVisible();
    const desktopBadge = desktopCreator.getByTestId('chon-membership-badge-diamond');
    await expectMediumTopRightMembershipBadge(desktopPhoto, desktopBadge);
    const desktopBadgeImage = desktopBadge.getByTestId('chon-membership-badge-image-diamond');
    await expect(desktopBadgeImage).toBeVisible();
    const desktopBadgeSource = await getRenderedImageSource(desktopBadgeImage);
    expect(desktopBadgeSource).toBeTruthy();
    expect(desktopBadgeSource).toBe(mobileBadgeSource);

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
