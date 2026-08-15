import { expect, test } from '@playwright/test';

const password = process.env.BR06_E2E_PASSWORD || 'Br06-local-only-2026!';
const actor = { email: 'br06.outsider@example.test' };

async function login(page) {
  await page.goto('/auth?mode=login');
  await expect(page.getByTestId('luxy-auth-screen')).toBeVisible();
  await expect(page.getByText('Đăng nhập', { exact: true }).first()).toBeVisible();
  await page.getByPlaceholder('email@example.com').fill(actor.email);
  await page.getByPlaceholder('Nhập mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập bằng email' }).click();
  await expect(page.getByTestId('luxy-search-desktop')).toBeVisible({ timeout: 30_000 });
}

async function xPosition(locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box.x;
}

test('authenticated Free desktop shell follows Chon.Love connection hierarchy and 1024px breakpoint', async ({ browser }, testInfo) => {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  try {
    await login(page);

    const desktopNavigation = page.getByTestId('chon-desktop-navigation');
    const shellBrand = page.getByRole('button', { name: 'Chon.Love — về Kết nối' });
    const connectionsNav = page.getByRole('button', { name: 'Kết nối', exact: true });
    const favoritesNav = page.getByRole('button', { name: 'Yêu thích', exact: true });
    const messagesNav = page.getByRole('button', { name: 'Tin nhắn', exact: true });
    const upgradeNav = page.getByRole('button', { name: 'Nâng cấp', exact: true });
    const accountButton = page.getByRole('button', { name: 'Mở menu tài khoản' });

    await expect(desktopNavigation).toBeVisible();
    await expect(page.getByTestId('luxy-free-upgrade-promo')).toBeVisible();
    await expect(shellBrand).toBeVisible();
    await expect(connectionsNav).toBeVisible();
    await expect(favoritesNav).toBeVisible();
    await expect(messagesNav).toBeVisible();
    await expect(upgradeNav).toBeVisible();
    await expect(accountButton).toBeVisible();
    await expect(page.getByTestId('chon-desktop-footer')).toBeVisible();

    const positions = await Promise.all([
      xPosition(shellBrand),
      xPosition(connectionsNav),
      xPosition(favoritesNav),
      xPosition(messagesNav),
      xPosition(upgradeNav),
      xPosition(accountButton),
    ]);

    for (let index = 1; index < positions.length; index += 1) {
      expect(positions[index]).toBeGreaterThan(positions[index - 1]);
    }

    await accountButton.click();
    await expect(page.getByRole('menu')).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Hồ sơ của tôi' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Hoạt động' })).toHaveCount(0);
    await expect(page.getByRole('menuitem', { name: 'Quà' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Số dư' })).toBeVisible();

    await page.setViewportSize({ width: 1023, height: 768 });
    await expect(desktopNavigation).toHaveCount(0);
    await expect(page.getByTestId('luxy-free-upgrade-promo')).toBeVisible();
    const compactBrand = page.getByRole('button', { name: 'Chọn.love — về Kết nối' });
    await expect(compactBrand).toBeVisible();
    const compactBrandBox = await compactBrand.boundingBox();
    expect(compactBrandBox).not.toBeNull();
    expect(compactBrandBox.height).toBeGreaterThan(0);
    await expect(page.getByRole('button', { name: 'Kết nối', exact: true })).toBeVisible();

    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(page.getByTestId('chon-desktop-navigation')).toBeVisible();
    await expect(page.getByTestId('luxy-free-upgrade-promo')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Chon.Love — về Kết nối' })).toBeVisible();

    await testInfo.attach('connection-free-desktop-shell-1280', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  } finally {
    await context.close();
  }
});
