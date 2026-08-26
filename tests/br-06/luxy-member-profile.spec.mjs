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
  await expect(page).toHaveURL(/\/thanh-vien\/id-[a-z0-9-]+/i, { timeout: 20_000 });
  await expect(page.getByTestId('chon-member-profile-page')).toBeVisible();
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

async function assertFreePrivatePhotoMembershipRedirect(page) {
  const entitlementButton = page.getByTestId('chon-private-photo-entitlement-button');
  await expect(entitlementButton).toBeVisible();
  await expect(entitlementButton).toContainText('Xem ảnh riêng tư');
  await entitlementButton.click();

  await expect(page).toHaveURL(/\/settings\/membership(?:\?|$)/);
  await expect(page.getByTestId('luxy-upgrade-billing')).toBeVisible();
  await expect(page.getByTestId('luxy-upgrade-gate-private_photo')).toHaveCount(0);

  await openCreatorProfile(page);
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

async function assertVerificationBadges(page, hoverTooltips = true) {
  const badges = page.getByTestId('chon-member-verification-badges');
  await expect(badges).toBeVisible();

  const checks = [
    /^(Đã|Chưa) xác thực ảnh chụp cá nhân$/,
    /^(Đã|Chưa) xác thực CCCD$/,
    /^(Đã|Chưa) xác thực LinkedIn$/,
  ];

  for (const matcher of checks) {
    const icon = badges.getByRole('button', { name: matcher });
    await expect(icon).toBeVisible();
    const tooltip = await icon.getAttribute('aria-label');
    expect(tooltip).toMatch(matcher);
    if (hoverTooltips && tooltip) {
      await icon.hover();
      await expect(page.getByText(tooltip, { exact: true })).toBeVisible();
    }
  }
}

test('UI-PRO01 desktop keeps Free Favorite while routing Private Photos to Membership and gating Message', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  try {
    await login(page, 'luxy-search-desktop');
    await openCreatorProfile(page);

    await expect(page.getByTestId('chon-membership-badge-diamond').first()).toBeVisible();
    await expect(page.getByText('Về tôi', { exact: true })).toBeVisible();
    await expect(page.getByText('Tôi đang tìm kiếm', { exact: true })).toBeVisible();
    await expect(page.getByText('Ẩm thực cao cấp', { exact: true })).toBeVisible();
    await expect(page.getByTestId('chon-member-profile-message-composer')).toBeVisible();
    await expect(page.getByText('Hoạt động & Album ảnh', { exact: true })).toHaveCount(0);
    const heroPhoto = page.getByTestId('chon-member-profile-hero-photo');
    await expect(heroPhoto).toBeVisible();
    await expect(heroPhoto.getByRole('button', { name: `Xem ảnh đại diện của ${creator.displayName}`, exact: true })).toBeVisible();
    await assertVerificationBadges(page);

    await assertFreePrivatePhotoMembershipRedirect(page);
    await expectNoHorizontalOverflow(page);

    await testInfo.attach('ui-pro01-desktop-member-profile-private-photo-membership', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });

    await heroPhoto.getByRole('button', { name: `Xem ảnh đại diện của ${creator.displayName}`, exact: true }).click();
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

    await testInfo.attach('ui-pro01-desktop-message-upgrade-gate', {
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

test('UI-PRO01 mobile profile keeps canonical Free promo below navigation and anchored profile actions on 390px web', async ({ browser }, testInfo) => {
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

    await expect(page.getByTestId('chon-member-profile-hero-photo')).toBeVisible();
    await expect(page.getByTestId('luxy-free-upgrade-promo')).toBeVisible();
    await expect(page.getByTestId('chon-profile-free-upgrade-promo')).toHaveCount(0);
    const mobileActionDock = page.getByTestId('chon-profile-mobile-action-dock');
    await expect(mobileActionDock).toBeVisible();
    const giftAction = mobileActionDock.getByRole('button', { name: `Tặng quà cho ${creator.displayName}` });
    const messageAction = mobileActionDock.getByRole('button', { name: `Gửi tin nhắn cho ${creator.displayName}` });
    await expect(giftAction).toBeVisible();
    await expect(messageAction).toBeVisible();
    await expect(page.getByTestId('chon-member-profile-message-composer')).toBeHidden();
    await expect(page.getByTestId('chon-membership-badge-diamond').first()).toBeVisible();
    await expect(page.getByText('Hoạt động & Album ảnh', { exact: true })).toHaveCount(0);
    await assertVerificationBadges(page, false);

    await assertFreePrivatePhotoMembershipRedirect(page);
    await expect(page.getByTestId('luxy-free-upgrade-promo')).toBeVisible();
    await expect(page.getByTestId('chon-profile-free-upgrade-promo')).toHaveCount(0);
    await expectNoHorizontalOverflow(page);

    const refreshedDock = page.getByTestId('chon-profile-mobile-action-dock');
    const refreshedGiftAction = refreshedDock.getByRole('button', { name: `Tặng quà cho ${creator.displayName}` });
    const refreshedMessageAction = refreshedDock.getByRole('button', { name: `Gửi tin nhắn cho ${creator.displayName}` });
    await refreshedGiftAction.click();
    await expect(page.getByText('Tặng quà', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Quà dành cho thành viên Cao cấp và Kim cương', { exact: true })).toBeVisible();
    await page.getByLabel('Đóng', { exact: true }).click();

    await testInfo.attach('ui-pro01-mobile-profile-verification-actions', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });

    await refreshedMessageAction.click();
    await expect(page).toHaveURL(/\/settings\/membership/);
    await expect(page.getByTestId('luxy-upgrade-billing')).toBeVisible();
  } finally {
    await context.close();
  }
});