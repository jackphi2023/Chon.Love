import { expect, test } from '@playwright/test';

const password = process.env.BR06_E2E_PASSWORD || 'Br06-local-only-2026!';

async function login(page) {
  await page.goto('/auth?mode=login');
  await page.getByPlaceholder('email@example.com').fill('br06.viewer@example.test');
  await page.getByPlaceholder('Nhập mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập bằng email' }).click();
  await expect(page.getByTestId('luxy-search-desktop')).toBeVisible({ timeout: 30_000 });
}

test('WEB-R02 member profile keeps photo and favorite as separate interactive controls', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  try {
    await login(page);
    await page.goto('/profile/br06_creator');
    await expect(page.getByTestId('luxy-member-profile-page')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: 'Xem ảnh đại diện của BR06 Creator' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Yêu thích BR06 Creator|^Bỏ yêu thích BR06 Creator/ })).toBeVisible();
    await expect(page.locator('button button')).toHaveCount(0);
  } finally {
    await context.close();
  }
});
