import { expect, test } from '@playwright/test';

const password = process.env.BR06_E2E_PASSWORD || 'Br06-local-only-2026!';
const actor = { email: 'br06.viewer@example.test' };

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

test('LX-03 authenticated desktop shell follows Seeking hierarchy and 1024px breakpoint', async ({ browser }, testInfo) => {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  try {
    await login(page);

    const shellBrand = page.getByRole('button', { name: 'Luxy.Love — về Tìm kiếm' });
    const searchNav = page.getByRole('button', { name: 'Tìm kiếm', exact: true });
    const favoritesNav = page.getByRole('button', { name: 'Yêu thích', exact: true });
    const messagesNav = page.getByRole('button', { name: 'Tin nhắn', exact: true });
    const upgradeNav = page.getByRole('button', { name: 'Nâng cấp', exact: true });
    const accountButton = page.getByRole('button', { name: 'Mở menu tài khoản Luxy' });

    await expect(page.getByText('Nâng cấp ngay', { exact: true })).toBeVisible();
    await expect(shellBrand).toBeVisible();
    await expect(shellBrand.getByText('Chon.Love', { exact: true })).toBeVisible();
    await expect(searchNav).toBeVisible();
    await expect(favoritesNav).toBeVisible();
    await expect(messagesNav).toBeVisible();
    await expect(upgradeNav).toBeVisible();
    await expect(accountButton).toBeVisible();

    const positions = await Promise.all([
      xPosition(shellBrand),
      xPosition(searchNav),
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
    await expect(page.getByRole('menuitem', { name: 'Hồ sơ' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Hoạt động' })).toHaveCount(0);
    await expect(page.getByRole('menuitem', { name: 'Quà' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Số dư' })).toBeVisible();

    await page.setViewportSize({ width: 1023, height: 768 });
    await expect(page.getByText('Nâng cấp ngay', { exact: true })).toHaveCount(0);
    await expect(shellBrand.getByText('Chon', { exact: true })).toBeVisible();

    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(page.getByText('Nâng cấp ngay', { exact: true })).toBeVisible();
    await expect(shellBrand.getByText('Chon.Love', { exact: true })).toBeVisible();

    await testInfo.attach('lx03-desktop-shell-1280', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  } finally {
    await context.close();
  }
});
