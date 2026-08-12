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

async function expectNoHorizontalOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewport + 1);
}

async function assertFreePrivatePhotoUpgradeGate(page) {
  const requestButton = page.getByTestId('luxy-private-photo-request-button');
  await expect(requestButton).toBeVisible();
  await requestButton.click();

  const upgradeGate = page.getByTestId('luxy-upgrade-gate-private_photo');
  await expect(upgradeGate).toBeVisible();
  await expect(upgradeGate.getByText('Xem ảnh riêng tư!', { exact: true })).toBeVisible();
  await expect(upgradeGate.getByText('Yêu cầu xem ảnh riêng tư', { exact: true })).toBeVisible();
  await expect(upgradeGate.getByText(/Chủ hồ sơ vẫn là người quyết định chấp thuận hoặc từ chối/)).toBeVisible();
  await expect(upgradeGate.getByRole('button', { name: 'Nâng cấp Premium' })).toBeVisible();

  await upgradeGate.getByRole('button', { name: 'Để sau' }).click();
  await expect(page.getByTestId('luxy-upgrade-gate-private_photo')).toHaveCount(0);
}

test('LX-14 desktop Member Profile gates Free Private Photo, Favorite and Message with Premium handoff', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  try {
    await login(page, 'luxy-search-desktop');
    await openCreatorProfile(page);

    await expect(page.getByTestId('luxy-membership-badge-diamond').first()).toBeVisible();
    await expect(page.getByText('Về tôi', { exact: true })).toBeVisible();
    await expect(page.getByText('Tôi đang tìm kiếm', { exact: true })).toBeVisible();
    await expect(page.getByText('Ẩm thực cao cấp', { exact: true })).toBeVisible();
    await expect(page.getByTestId('luxy-member-profile-message-composer')).toBeVisible();
    const heroPhoto = page.getByTestId('luxy-member-profile-hero-photo');
    await expect(heroPhoto).toBeVisible();
    await expect(heroPhoto.getByRole('img', { name: `Ảnh đại diện của ${creator.displayName}`, exact: true })).toBeVisible();

    await assertFreePrivatePhotoUpgradeGate(page);
    await expectNoHorizontalOverflow(page);

    await testInfo.attach('lx14-desktop-member-profile-private-photo-gate', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });

    await heroPhoto.click();
    const photoModal = page.getByTestId('luxy-profile-photo-modal');
    await expect(photoModal).toBeVisible();
    await expect(photoModal.getByRole('img', { name: `Ảnh của ${creator.displayName}`, exact: true })).toBeVisible();

    const favorite = photoModal.getByRole('button', { name: new RegExp(`^(Yêu thích|Bỏ yêu thích) ${creator.displayName}`) });
    await expect(favorite).toBeVisible();
    await favorite.click();
    await expect(page.getByTestId('luxy-upgrade-gate-favorite')).toBeVisible();
    await expect(page.getByText('Mở khóa Interest!', { exact: true })).toBeVisible();
    await expect(page.getByText('Gửi Interest / Yêu thích', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Để sau' }).click();
    await expect(page.getByTestId('luxy-upgrade-gate-favorite')).toHaveCount(0);

    await photoModal.getByLabel(`Tin nhắn cho ${creator.displayName}`).fill('Xin chào từ ảnh hồ sơ');
    await photoModal.getByRole('button', { name: `Nhắn tin cho ${creator.displayName}` }).click();

    await expect(page.getByTestId('luxy-upgrade-gate-message')).toBeVisible();
    await expect(page.getByText('Bắt đầu nhắn tin ngay!', { exact: true })).toBeVisible();
    await expect(page.getByText('Nhắn tin với thành viên', { exact: true })).toBeVisible();
    await expect(page.getByText('Huy hiệu Premium', { exact: true })).toBeVisible();

    await testInfo.attach('lx14-desktop-message-upgrade-gate', {
      body: await page.screenshot({ fullPage: false }),
      contentType: 'image/png',
    });

    await page.getByTestId('luxy-message-upgrade-cta').click();
    await expect(page.getByTestId('luxy-membership-settings')).toBeVisible();
  } finally {
    await context.close();
  }
});

test('LX-14 mobile Member Profile keeps Seeking hierarchy and gates Private Photo + Message for Free', async ({ browser }, testInfo) => {
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

    await expect(page.getByTestId('luxy-member-profile-hero-photo')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nhắn tin', exact: true })).toBeVisible();
    await expect(page.getByTestId('luxy-membership-badge-diamond').first()).toBeVisible();

    await assertFreePrivatePhotoUpgradeGate(page);
    await expectNoHorizontalOverflow(page);

    await testInfo.attach('lx14-mobile-member-profile-private-photo-gate', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });

    await page.getByRole('button', { name: 'Nhắn tin', exact: true }).click();
    await expect(page.getByTestId('luxy-upgrade-gate-message')).toBeVisible();
    await expect(page.getByTestId('luxy-message-upgrade-cta')).toBeVisible();
    await page.getByRole('button', { name: 'Để sau' }).click();
    await expect(page.getByTestId('luxy-upgrade-gate-message')).toHaveCount(0);
  } finally {
    await context.close();
  }
});
