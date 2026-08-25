import { expect, test } from '@playwright/test';

const password = process.env.BR06_E2E_PASSWORD || 'Br06-local-only-2026!';
const actor = { email: 'br06.outsider@example.test' };

async function login(page) {
  await page.goto('/auth?mode=login');
  await expect(page.getByTestId('luxy-auth-screen')).toBeVisible();
  await page.getByLabel('Email', { exact: true }).fill(actor.email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập bằng email' }).click();
  await expect(page.getByTestId('luxy-search-mobile')).toBeVisible({ timeout: 30_000 });
}

async function expectSingleStandaloneChrome(page) {
  await expect(page.getByTestId('chon-settings-page-chrome')).toHaveCount(1);
  await expect(page.getByTestId('chon-authenticated-navigation')).toHaveCount(1);
  await expect(page.getByTestId('chon-authenticated-footer')).toHaveCount(1);
}

test('settings and membership share one authenticated page chrome without duplicate headers', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  try {
    await login(page);
    await page.goto('/settings');
    await expect(page.getByTestId('chon-settings-page')).toBeVisible({ timeout: 30_000 });
    await expectSingleStandaloneChrome(page);
    await expect(page.getByRole('button', { name: 'Chọn.love — về Kết nối' })).toHaveCount(1);

    await page.getByTestId('settings-membership').click();
    await expect(page).toHaveURL(/\/settings\/membership$/);
    await expect(page.getByTestId('luxy-upgrade-billing')).toBeVisible({ timeout: 30_000 });
    await expectSingleStandaloneChrome(page);
    await expect(page.getByRole('button', { name: 'Quay lại' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Nâng cấp trải nghiệm của bạn' })).toHaveCount(1);

    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(page.getByTestId('chon-desktop-navigation')).toHaveCount(1);
    await expect(page.getByTestId('chon-authenticated-navigation')).toHaveCount(1);
    await expect(page.getByTestId('chon-authenticated-footer')).toHaveCount(1);
  } finally {
    await context.close();
  }
});
