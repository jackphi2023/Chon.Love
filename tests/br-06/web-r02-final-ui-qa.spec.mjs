import { expect, test } from '@playwright/test';

const password = process.env.BR06_E2E_PASSWORD || 'Br06-local-only-2026!';
const creator = { username: 'br06_creator', displayName: 'BR06 Creator' };
const premiumActor = { email: 'br06.viewer@example.test' };
const freeActor = { email: 'br06.outsider@example.test' };

const viewports = [
  { width: 390, height: 844, name: '390' },
  { width: 430, height: 932, name: '430' },
  { width: 768, height: 1024, name: '768' },
  { width: 1024, height: 768, name: '1024' },
  { width: 1280, height: 900, name: '1280' },
  { width: 1440, height: 1000, name: '1440' },
];

async function expectNoHorizontalOverflow(page, screen) {
  const metrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body?.scrollWidth ?? 0,
  }));
  expect(metrics.scrollWidth, `${screen}: document overflow`).toBeLessThanOrEqual(metrics.clientWidth + 1);
  expect(metrics.bodyWidth, `${screen}: body overflow`).toBeLessThanOrEqual(metrics.clientWidth + 1);
}

async function capture(page, testInfo, viewport, screen, fullPage = true) {
  await expectNoHorizontalOverflow(page, `${screen}-${viewport.name}`);
  await testInfo.attach(`web-r02-${screen}-${viewport.name}`, {
    body: await page.screenshot({ fullPage }),
    contentType: 'image/png',
  });
}

async function login(page, actor) {
  await page.goto('/auth?mode=login');
  await expect(page.getByTestId('luxy-auth-screen')).toBeVisible();
  await page.getByPlaceholder('email@example.com').fill(actor.email);
  await page.getByPlaceholder('Nhập mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập bằng email' }).click();
  await expect(page.getByText('Tìm kiếm', { exact: true }).first()).toBeVisible({ timeout: 30_000 });
}

async function openSearch(page) {
  await page.goto('/');
  await expect(page.getByText('Tìm kiếm', { exact: true }).first()).toBeVisible({ timeout: 30_000 });
}

for (const viewport of viewports) {
  test(`WEB-R02 public/auth UI has no overflow at ${viewport.name}px`, async ({ browser }, testInfo) => {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    try {
      await page.goto('/');
      await expect(page.getByTestId('luxy-public-homepage')).toBeVisible();
      await capture(page, testInfo, viewport, 'homepage');

      await page.goto('/auth?mode=login');
      await expect(page.getByTestId('luxy-auth-screen')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Đăng nhập', exact: true })).toBeVisible();
      await capture(page, testInfo, viewport, 'login');

      await page.goto('/auth');
      await expect(page.getByRole('heading', { name: 'Đăng ký', exact: true })).toBeVisible();
      await page.getByRole('radio', { name: 'Nam', exact: true }).first().click();
      await page.getByRole('radio', { name: 'Nữ', exact: true }).last().click();
      await page.getByRole('button', { name: 'Tiếp tục đăng ký' }).click();
      await expect(page.getByRole('button', { name: 'Tạo tài khoản bằng email' })).toBeVisible();
      await capture(page, testInfo, viewport, 'signup');
    } finally {
      await context.close();
    }
  });
}

test('WEB-R02 onboarding/profile/selfie UI is responsive across the six release widths', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  try {
    await page.goto('/auth');
    await page.getByRole('radio', { name: 'Nam', exact: true }).first().click();
    await page.getByRole('radio', { name: 'Nữ', exact: true }).last().click();
    await page.getByRole('button', { name: 'Tiếp tục đăng ký' }).click();
    const uniqueEmail = `web-r02-${Date.now()}@example.test`;
    await page.getByPlaceholder('email@example.com').fill(uniqueEmail);
    await page.getByPlaceholder('Tối thiểu 10 ký tự').fill(password);
    await page.getByRole('button', { name: 'Tạo tài khoản bằng email' }).click();
    await expect(page.getByRole('heading', { name: 'Xác nhận bạn từ đủ 18 tuổi' })).toBeVisible({ timeout: 30_000 });

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await expect(page.getByRole('heading', { name: 'Xác nhận bạn từ đủ 18 tuổi' })).toBeVisible();
      await capture(page, testInfo, viewport, 'onboarding-18plus');

      await page.goto('/onboarding/profile');
      await expect(page.getByRole('heading', { name: 'Tạo hồ sơ Luxy.Love' })).toBeVisible({ timeout: 20_000 });
      await expect(page.getByRole('button', { name: /Upload ảnh hồ sơ|Chọn ảnh khác/ })).toBeVisible();
      await capture(page, testInfo, viewport, 'onboarding-profile');

      await page.goto('/onboarding/selfie');
      await expect(page.getByRole('heading', { name: 'Chụp selfie xác minh' })).toBeVisible({ timeout: 20_000 });
      await expect(page.getByRole('button', { name: 'Bật camera' })).toBeVisible();
      await capture(page, testInfo, viewport, 'selfie');

      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'Xác nhận bạn từ đủ 18 tuổi' })).toBeVisible({ timeout: 20_000 });
    }
  } finally {
    await context.close();
  }
});

for (const viewport of viewports) {
  test(`WEB-R02 authenticated Seeking-style surface matrix at ${viewport.name}px`, async ({ browser }, testInfo) => {
    const premiumContext = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
    const freeContext = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
    const page = await premiumContext.newPage();
    const freePage = await freeContext.newPage();

    try {
      await Promise.all([login(page, premiumActor), login(freePage, freeActor)]);

      await openSearch(page);
      const desktopSearch = page.getByTestId('luxy-search-desktop');
      const mobileSearch = page.getByTestId('luxy-search-mobile');
      if (viewport.width >= 1024) {
        await expect(desktopSearch).toBeVisible();
        await expect(page.getByTestId('luxy-search-filter-rail')).toBeVisible();
        await capture(page, testInfo, viewport, 'search');
        await capture(page, testInfo, viewport, 'filter');
      } else {
        await expect(mobileSearch).toBeVisible();
        await capture(page, testInfo, viewport, 'search');
        await page.getByTestId('luxy-search-mobile-filter-button').click();
        await expect(page.getByTestId('luxy-search-mobile-filter-sheet')).toBeVisible();
        await capture(page, testInfo, viewport, 'filter');
        await page.getByTestId('luxy-search-mobile-filter-apply').click();
      }

      await freePage.goto(`/profile/${creator.username}`);
      await expect(freePage.getByTestId('luxy-member-profile-page')).toBeVisible({ timeout: 20_000 });
      await expect(freePage.getByRole('heading', { name: new RegExp(`^${creator.displayName},`) })).toBeVisible();
      await expect(freePage.locator('button button'), 'Member Profile must not render nested interactive buttons').toHaveCount(0);
      await expect(freePage.getByTestId('luxy-private-photo-entitlement-button')).toContainText('Nâng cấp');
      await capture(freePage, testInfo, viewport, 'member-profile');

      await page.goto('/favorites');
      await expect(page.getByTestId('luxy-interests-page')).toBeVisible();
      await expect(page.getByTestId('luxy-interests-tab-viewed_me')).toHaveAttribute('aria-selected', 'true');
      await capture(page, testInfo, viewport, 'interests-viewed-me');

      await page.getByRole('tab', { name: 'Yêu thích', exact: true }).click();
      await capture(page, testInfo, viewport, 'interests-favorites');
      await page.getByRole('tab', { name: 'Yêu thích tôi', exact: true }).click();
      await capture(page, testInfo, viewport, 'interests-favorited-me');

      await page.goto('/messages');
      await expect(page.getByTestId('luxy-messages-page')).toBeVisible({ timeout: 20_000 });
      await capture(page, testInfo, viewport, 'messages');

      await page.goto(`/profile/${creator.username}`);
      await expect(page.getByTestId('luxy-member-profile-page')).toBeVisible();
      await page.getByRole('button', { name: 'Nhắn tin', exact: true }).click();
      await expect(page.getByRole('textbox', { name: 'Nội dung tin nhắn', exact: true })).toBeVisible({ timeout: 20_000 });
      await capture(page, testInfo, viewport, 'chat');

      await page.goto('/profile/edit');
      await expect(page.getByTestId('lx08-edit-profile-page')).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId('lx08-profile-form')).toBeVisible({ timeout: 20_000 });
      await capture(page, testInfo, viewport, 'edit-profile');

      await page.goto('/settings');
      await expect(page.getByTestId('luxy-settings-page')).toBeVisible({ timeout: 20_000 });
      await capture(page, testInfo, viewport, 'settings');

      await page.goto('/settings/membership');
      await expect(page.getByTestId('luxy-upgrade-billing')).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText('Premium', { exact: true }).first()).toBeVisible();
      await expect(page.getByText('Diamond', { exact: true }).first()).toBeVisible();
      await capture(page, testInfo, viewport, 'membership');

      await page.goto('/settings/verification');
      await expect(page.getByTestId('luxy-verification-settings')).toBeVisible({ timeout: 20_000 });
      await capture(page, testInfo, viewport, 'verification');

      await page.goto('/settings/private-photos');
      await expect(page.getByTestId('luxy-private-photo-settings')).toBeVisible({ timeout: 20_000 });
      await capture(page, testInfo, viewport, 'private-photos');

      await freePage.goto(`/profile/${creator.username}`);
      await expect(freePage.getByTestId('luxy-member-profile-page')).toBeVisible({ timeout: 20_000 });
      await freePage.getByRole('button', { name: 'Nhắn tin', exact: true }).click();
      const upgradeGate = freePage.getByTestId('luxy-upgrade-gate-message');
      await expect(upgradeGate).toBeVisible();
      expect(await upgradeGate.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        return [0.25, 0.5, 0.75].every((ratio) => {
          const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height * ratio);
          return Boolean(top && node.contains(top));
        });
      }), 'Upgrade modal must be the top visual stacking layer').toBe(true);
      await capture(freePage, testInfo, viewport, 'upgrade-gate', false);
      await freePage.getByRole('button', { name: 'Để sau' }).click();

      await freePage.goto('/settings/membership');
      const checkoutButton = freePage.getByTestId('membership-checkout-cta');
      await expect(checkoutButton).toBeVisible({ timeout: 20_000 });
      await expect(checkoutButton).toBeEnabled({ timeout: 20_000 });
      await checkoutButton.click();
      const qrImage = freePage.getByLabel('Mã VietQR thanh toán gói thành viên');
      await expect(qrImage).toBeVisible({ timeout: 20_000 });
      expect(await qrImage.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + Math.min(rect.height / 2, 80));
        return top === node || Boolean(top && node.contains(top));
      }), 'VietQR modal must stay above Membership page').toBe(true);
      await capture(freePage, testInfo, viewport, 'vietqr-checkout', false);
      const cancelButton = freePage.getByRole('button', { name: 'Hủy yêu cầu' });
      if (await cancelButton.isVisible()) await cancelButton.click();
      const closeButton = freePage.getByRole('button', { name: 'Đóng' });
      if (await closeButton.isVisible()) await closeButton.click();
    } finally {
      await Promise.all([premiumContext.close(), freeContext.close()]);
    }
  });
}
