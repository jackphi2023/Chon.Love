import { expect, test } from '@playwright/test';

const password = process.env.BR06_E2E_PASSWORD || 'Br06-local-only-2026!';
const viewer = { email: 'br06.viewer@example.test' };
const creator = { username: 'br06_creator', displayName: 'BR06 Creator' };

async function login(page) {
  await page.goto('/auth?mode=login');
  await expect(page.getByTestId('luxy-auth-screen')).toBeVisible();
  await page.getByPlaceholder('email@example.com').fill(viewer.email);
  await page.getByPlaceholder('Nhập mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập bằng email' }).click();
  await expect(page.getByTestId('luxy-search-mobile')).toBeVisible({ timeout: 30_000 });
}

test('UI-GIFT01 keeps the 20-gift heart catalog while presenting one responsive Chon.Love picker', async ({ browser }, testInfo) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  try {
    await login(page);
    await page.goto(`/profile/${creator.username}`);
    await expect(page.getByTestId('luxy-member-profile-page')).toBeVisible({ timeout: 20_000 });

    const giftAction = page.getByRole('button', { name: `Tặng quà cho ${creator.displayName}`, exact: true });
    await expect(giftAction).toBeVisible();
    await giftAction.click();

    const picker = page.getByTestId('chon-gift-picker');
    await expect(picker).toBeVisible();
    await expect(picker.getByRole('heading', { name: 'Tặng quà', exact: true })).toBeVisible();
    await expect(picker.getByTestId('chon-gift-picker-balance')).toContainText('❤️');
    await expect(picker.getByText('Giá quà được hiển thị bằng ❤️.', { exact: true })).toBeVisible();

    const items = picker.getByTestId('chon-gift-picker-item');
    await expect(items).toHaveCount(20);
    await expect(picker.getByRole('button', { name: 'Donut, 1 ❤️', exact: true })).toBeVisible();
    await expect(picker.getByRole('button', { name: 'Vương miện, 20 ❤️', exact: true })).toBeVisible();

    const pickerText = await picker.innerText();
    expect(pickerText).not.toMatch(/VNĐ|VND|₫/i);

    await testInfo.attach('ui-gift01-mobile-picker', {
      body: await page.screenshot({ fullPage: false }),
      contentType: 'image/png',
    });

    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(picker).toBeVisible();
    await expect(items).toHaveCount(20);
    const desktopBox = await picker.boundingBox();
    expect(desktopBox).not.toBeNull();
    expect(desktopBox.width).toBeLessThanOrEqual(602);

    await testInfo.attach('ui-gift01-desktop-picker', {
      body: await page.screenshot({ fullPage: false }),
      contentType: 'image/png',
    });
  } finally {
    await context.close();
  }
});
