import { expect, test } from '@playwright/test';

const password = process.env.BR06_E2E_PASSWORD || 'Br06-local-only-2026!';
const actor = { email: 'br06.outsider@example.test' };
const navLogoHeight = 26 * 1.16;

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

async function expectScaledNavigationLogo(brand) {
  const logo = brand.getByTestId('chon-love-wordmark');
  await expect(logo).toBeVisible();
  const box = await logo.boundingBox();
  expect(box).not.toBeNull();
  expect(Math.abs(box.height - navLogoHeight)).toBeLessThanOrEqual(1);
}

async function expectCleanAccountMenu(page) {
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  for (const label of ['Hồ sơ', 'Quà tặng', 'Số dư', 'Cài đặt', 'Đăng xuất']) {
    await expect(menu.getByRole('menuitem', { name: label, exact: true })).toBeVisible();
  }
  await expect(menu.getByRole('menuitem', { name: 'Hồ sơ của tôi', exact: true })).toHaveCount(0);
  await expect(menu.getByText('Chọn.love · hồ sơ & cài đặt', { exact: true })).toHaveCount(0);
  await expect(menu.getByText('Hồ sơ & cài đặt tài khoản', { exact: true })).toHaveCount(0);
  await expect(menu.locator('img')).toHaveCount(0);

  const menuBox = await menu.boundingBox();
  expect(menuBox).not.toBeNull();
  expect(menuBox.width).toBeLessThanOrEqual(160);

  const profileItem = menu.getByRole('menuitem', { name: 'Hồ sơ', exact: true });
  await profileItem.hover();
  await expect(profileItem).toHaveCSS('background-color', 'rgb(255, 187, 0)');
  await page.mouse.move(0, 0);
}

test('authenticated Free desktop shell follows refreshed Chon.Love navigation and 1024px breakpoint', async ({ browser }, testInfo) => {
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
    const accountButton = page.getByRole('button', { name: 'Mở menu hồ sơ' });

    await expect(desktopNavigation).toBeVisible();
    await expect(page.getByTestId('chon-authenticated-navigation')).toHaveCount(1);
    await expect(page.getByTestId('luxy-free-upgrade-promo')).toBeVisible();
    await expect(shellBrand).toBeVisible();
    await expectScaledNavigationLogo(shellBrand);
    await expect(connectionsNav).toBeVisible();
    await expect(favoritesNav).toBeVisible();
    await expect(messagesNav).toBeVisible();
    await expect(upgradeNav).toBeVisible();
    await expect(accountButton).toBeVisible();
    await expect(accountButton).not.toContainText(/[⌃⌄v]/u);
    await expect(page.getByTestId('chon-authenticated-footer')).toHaveCount(1);

    const avatar = accountButton.locator('img').first();
    if (await avatar.count()) {
      const avatarBox = await avatar.boundingBox();
      expect(avatarBox).not.toBeNull();
      expect(avatarBox.width).toBeLessThanOrEqual(28);
    }

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
    await expectCleanAccountMenu(page);
    await accountButton.click();

    await page.setViewportSize({ width: 1023, height: 768 });
    await expect(desktopNavigation).toHaveCount(0);
    await expect(page.getByTestId('luxy-free-upgrade-promo')).toBeVisible();
    const compactBrand = page.getByRole('button', { name: 'Chọn.love — về Kết nối' });
    await expect(compactBrand).toBeVisible();
    const compactBrandBox = await compactBrand.boundingBox();
    expect(compactBrandBox).not.toBeNull();
    expect(compactBrandBox.height).toBeGreaterThan(0);
    await expect(page.getByRole('button', { name: 'Kết nối', exact: true })).toBeVisible();
    await expect(page.getByTestId('chon-authenticated-footer')).toHaveCount(0);

    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(page.getByTestId('chon-desktop-navigation')).toBeVisible();
    await expect(page.getByTestId('luxy-free-upgrade-promo')).toBeVisible();
    const restoredBrand = page.getByRole('button', { name: 'Chon.Love — về Kết nối' });
    await expect(restoredBrand).toBeVisible();
    await expectScaledNavigationLogo(restoredBrand);
    await expect(page.getByTestId('chon-authenticated-footer')).toHaveCount(1);

    await testInfo.attach('connection-free-desktop-shell-1280', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  } finally {
    await context.close();
  }
});

test('account menu logout clears the session and returns directly to homepage', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  try {
    await login(page);
    await page.getByRole('button', { name: 'Mở menu hồ sơ' }).click();
    await expectCleanAccountMenu(page);
    await page.getByTestId('chon-navigation-logout').click();
    await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
    await expect(page.getByTestId('chon-love-public-homepage')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('luxy-auth-screen')).toHaveCount(0);
  } finally {
    await context.close();
  }
});
