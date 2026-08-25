import { expect, test } from '@playwright/test';

const password = process.env.BR06_E2E_PASSWORD || 'Br06-local-only-2026!';
const freeActor = { email: 'br06.outsider@example.test' };
const creator = { username: 'br06_creator' };

async function login(page) {
  await page.goto('/auth?mode=login');
  await page.getByPlaceholder('email@example.com').fill(freeActor.email);
  await page.getByPlaceholder('Nhập mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập bằng email' }).click();
  await expect(page.getByTestId('luxy-search-desktop')).toBeVisible({ timeout: 30_000 });
}

async function expectCleanBranding(page, screen) {
  const body = page.locator('body');
  await expect(body, `${screen}: MyFan must not be visible`).not.toContainText('MyFan');
  await expect(body, `${screen}: internal LX labels must not be visible`).not.toContainText(/LX-[0-9]{2}/);
  await expect(body, `${screen}: Album Fan must not be visible`).not.toContainText('Album Fan');
  await expect(body, `${screen}: deferred Activity branding must not be visible`).not.toContainText('Hoạt động');
}

test('WEB-R03 public/auth surfaces use Chọn.love branding', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('chon-love-public-homepage')).toBeVisible();
  await expectCleanBranding(page, 'homepage');
  await page.goto('/auth');
  await expect(page.getByTestId('luxy-auth-screen')).toBeVisible();
  await expectCleanBranding(page, 'auth');
});

test('WEB-R03 authenticated core surfaces expose no legacy brand or phase labels', async ({ page }) => {
  await login(page);
  for (const [path, marker] of [
    ['/', 'luxy-search-desktop'],
    [`/profile/${creator.username}`, 'chon-member-profile-page'],
    ['/settings', 'chon-settings-page'],
    ['/settings/membership', 'luxy-upgrade-billing'],
    ['/settings/private-photos', 'luxy-private-photo-settings'],
    ['/settings/verification', 'luxy-verification-settings'],
  ]) {
    await page.goto(path);
    if (path.startsWith('/profile/')) {
      await expect(page).toHaveURL(/\/thanh-vien\/id-[0-9a-f]{6}$/i, { timeout: 30_000 });
    }
    await expect(page.getByTestId(marker)).toBeVisible({ timeout: 30_000 });
    await expectCleanBranding(page, path);
  }
});
