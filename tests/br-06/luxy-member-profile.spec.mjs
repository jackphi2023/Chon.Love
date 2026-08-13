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

async function assertPaidPlanComparison(upgradeGate) {
  await expect(upgradeGate.getByTestId('luxy-upgrade-plan-premium')).toBeVisible();
  await expect(upgradeGate.getByTestId('luxy-upgrade-plan-diamond')).toBeVisible();
  await expect(upgradeGate.getByText('Gửi và nhận tin nhắn với thành viên', { exact: true })).toBeVisible();
  await expect(upgradeGate.getByText('Xem đầy đủ ảnh riêng tư', { exact: true })).toBeVisible();
  await expect(upgradeGate.getByText('Huy hiệu thành viên Premium', { exact: true })).toBeVisible();
  await expect(upgradeGate.getByText('Bao gồm toàn bộ quyền tương tác Premium', { exact: true })).toBeVisible();
  await expect(upgradeGate.getByText('Tự động xem đầy đủ ảnh riêng tư', { exact: true })).toBeVisible();
  await expect(upgradeGate.getByText('Huy hiệu Diamond — hạng thành viên cao nhất', { exact: true })).toBeVisible();
  await expect(upgradeGate.getByRole('button', { name: 'Nâng cấp Premium' })).toBeVisible();
  await expect(upgradeGate.getByRole('button', { name: 'Nâng cấp Diamond' })).toBeVisible();
  await expect(upgradeGate.getByText('Yêu thích vẫn sử dụng miễn phí với tài khoản Free.', { exact: true })).toBeVisible();
}

async function assertFreePrivatePhotoMembershipGate(page) {
  const entitlementButton = page.getByTestId('luxy-private-photo-entitlement-button');
  await expect(entitlementButton).toBeVisible();
  await expect(entitlementButton).toContainText('Xem ảnh riêng tư');
  await entitlementButton.click();

  const upgradeGate = page.getByTestId('luxy-upgrade-gate-private_photo');
  await expect(upgradeGate).toBeVisible();
  await expect(upgradeGate.getByText('Xem ảnh riêng tư!', { exact: true })).toBeVisible();
  await expect(upgradeGate.getByText(/Premium hoặc Diamond tự động được xem đầy đủ ảnh riêng tư/)).toBeVisible();
  await expect(upgradeGate.getByText(/trạng thái gói trên server/)).toBeVisible();
  await expect(upgradeGate.getByText(/chấp thuận|từ chối/i)).toHaveCount(0);
  await expect(upgradeGate.getByText(/yêu cầu duyệt cũ không mở khóa ảnh riêng tư/)).toBeVisible();
  await assertPaidPlanComparison(upgradeGate);

  await upgradeGate.getByRole('button', { name: 'Để sau' }).click();
  await expect(page.getByTestId('luxy-upgrade-gate-private_photo')).toHaveCount(0);
}

async function assertFreeFavoriteWorks(photoModal, page) {
  const favorite = photoModal.getByRole('button', { name: new RegExp(`^(Yêu thích|Bỏ yêu thích) ${creator.displayName}`) });
  await expect(favorite).toBeVisible();
  const initialLabel = await favorite.getAttribute('aria-label');
  await favorite.click();
  await expect(page.getByTestId('luxy-upgrade-gate-favorite')).toHaveCount(0);

  if (initialLabel?.startsWith('Bỏ yêu thích')) {
    const toggled = photoModal.getByRole('button', { name: `Yêu thích ${creator.displayName}`, exact: true });
    await expect(toggled).toBeVisible();
    await toggled.click();
    await expect(photoModal.getByRole('button', { name: new RegExp(`^Bỏ yêu thích ${creator.displayName}`) })).toBeVisible();
  } else {
    const toggled = photoModal.getByRole('button', { name: new RegExp(`^Bỏ yêu thích ${creator.displayName}`) });
    await expect(toggled).toBeVisible();
    await toggled.click();
    await expect(photoModal.getByRole('button', { name: `Yêu thích ${creator.displayName}`, exact: true })).toBeVisible();
  }
}

test('LX-20 desktop keeps Free Favorite while gating Private Photos and Message behind Premium or Diamond', async ({ browser }, testInfo) => {
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
    await expect(page.getByText('Hoạt động & Album ảnh', { exact: true })).toHaveCount(0);
    const heroPhoto = page.getByTestId('luxy-member-profile-hero-photo');
    await expect(heroPhoto).toBeVisible();
    await expect(heroPhoto.getByRole('img', { name: `Ảnh đại diện của ${creator.displayName}`, exact: true })).toBeVisible();

    await assertFreePrivatePhotoMembershipGate(page);
    await expectNoHorizontalOverflow(page);

    await testInfo.attach('lx20-desktop-member-profile-private-photo-gate', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });

    await heroPhoto.click();
    const photoModal = page.getByTestId('luxy-profile-photo-modal');
    await expect(photoModal).toBeVisible();
    await expect(photoModal.getByRole('img', { name: `Ảnh của ${creator.displayName}`, exact: true })).toBeVisible();

    await assertFreeFavoriteWorks(photoModal, page);

    await photoModal.getByLabel(`Tin nhắn cho ${creator.displayName}`).fill('Xin chào từ ảnh hồ sơ');
    await photoModal.getByRole('button', { name: `Nhắn tin cho ${creator.displayName}` }).click();

    const messageGate = page.getByTestId('luxy-upgrade-gate-message');
    await expect(messageGate).toBeVisible();
    await expect(messageGate.getByText('Bắt đầu nhắn tin ngay!', { exact: true })).toBeVisible();
    await expect(messageGate.getByText(/Để gửi tin nhắn, hãy nâng cấp Premium hoặc Diamond/)).toBeVisible();
    await assertPaidPlanComparison(messageGate);

    await testInfo.attach('lx20-desktop-message-upgrade-gate', {
      body: await page.screenshot({ fullPage: false }),
      contentType: 'image/png',
    });

    await messageGate.getByTestId('luxy-diamond-upgrade-cta').click();
    await expect(page).toHaveURL(/\/settings\/membership.*plan=diamond/);
    await expect(page.getByTestId('luxy-upgrade-billing')).toBeVisible();
  } finally {
    await context.close();
  }
});

test('LX-20 mobile keeps Free Favorite and membership-entitled Private Photos on 390px web', async ({ browser }, testInfo) => {
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
    await expect(page.getByText('Hoạt động & Album ảnh', { exact: true })).toHaveCount(0);

    await assertFreePrivatePhotoMembershipGate(page);
    await expectNoHorizontalOverflow(page);

    await testInfo.attach('lx20-mobile-member-profile-private-photo-gate', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });

    await page.getByRole('button', { name: 'Nhắn tin', exact: true }).click();
    const messageGate = page.getByTestId('luxy-upgrade-gate-message');
    await expect(messageGate).toBeVisible();
    await assertPaidPlanComparison(messageGate);
    await messageGate.getByTestId('luxy-message-upgrade-cta').click();
    await expect(page).toHaveURL(/\/settings\/membership.*plan=premium/);
    await expect(page.getByTestId('luxy-upgrade-billing')).toBeVisible();
  } finally {
    await context.close();
  }
});
