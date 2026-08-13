import { expect, test } from '@playwright/test';

const password = process.env.BR06_E2E_PASSWORD || 'Br06-local-only-2026!';
const actor = { email: 'br06.viewer@example.test' };

async function login(page) {
  await page.goto('/auth?mode=login');
  await expect(page.getByTestId('luxy-auth-screen')).toBeVisible();
  await page.getByPlaceholder('email@example.com').fill(actor.email);
  await page.getByPlaceholder('Nhập mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập bằng email' }).click();
  await expect(page.getByText('Tìm kiếm', { exact: true }).first()).toBeVisible({ timeout: 30_000 });
}

async function assertNoHorizontalOverflow(page) {
  const widths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
}

async function openSettingsFromAccountMenu(page) {
  await page.getByRole('button', { name: 'Mở menu tài khoản Luxy' }).click();
  const settingsItem = page.getByRole('menuitem', { name: 'Cài đặt' });
  await expect(settingsItem).toBeVisible();
  await settingsItem.click();
  await expect(page.getByTestId('luxy-settings-page')).toBeVisible();
}

async function assertSettingsHub(page) {
  await expect(page.getByRole('heading', { name: 'Cài đặt' })).toBeVisible();
  await expect(page.getByTestId('settings-profile-section')).toBeVisible();
  await expect(page.getByTestId('settings-verification-section')).toBeVisible();
  await expect(page.getByTestId('settings-membership-section')).toBeVisible();
  await expect(page.getByTestId('settings-gifts-section')).toBeVisible();
  await expect(page.getByTestId('settings-account-section')).toBeVisible();
  await expect(page.getByText('Ảnh riêng tư', { exact: true })).toBeVisible();
  await expect(page.getByText('Xác thực hồ sơ', { exact: true })).toBeVisible();
  await expect(page.getByText('Gói thành viên', { exact: true })).toBeVisible();
  await expect(page.getByText('Cài đặt quà tặng', { exact: true })).toBeVisible();
}

test('WEB-R01 Settings hub follows final Luxy V1 contract on desktop', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  try {
    await login(page);
    await openSettingsFromAccountMenu(page);
    await assertSettingsHub(page);
    await assertNoHorizontalOverflow(page);

    await page.getByTestId('settings-verification').click();
    await expect(page.getByTestId('luxy-verification-settings')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Bật camera & chụp selfie' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Upload mặt trước CCCD' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Upload mặt sau CCCD' })).toBeVisible();
    await expect(page.getByTestId('verification-submit')).toBeDisabled();
    await assertNoHorizontalOverflow(page);

    await page.goto('/settings/private-photos');
    await expect(page.getByTestId('luxy-private-photo-settings')).toBeVisible();
    await expect(page.getByTestId('private-photo-upload')).toBeVisible();
    await expect(page.getByText('Quà tặng, Fan và trạng thái kết nối không mở khóa ảnh riêng tư.', { exact: false })).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await page.goto('/settings/membership');
    await expect(page.getByTestId('luxy-membership-settings')).toBeVisible();
    await expect(page.getByText('Premium', { exact: true })).toBeVisible();
    await expect(page.getByText('Diamond', { exact: true })).toBeVisible();

    await page.goto('/settings/gifts');
    await expect(page.getByTestId('luxy-gift-settings')).toBeVisible();
    await expect(page.getByText('Tặng quà không mở ảnh riêng tư', { exact: false })).toBeVisible();

    await testInfo.attach('web-r01-settings-1280', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  } finally {
    await context.close();
  }
});

test('WEB-R01 Settings remains usable on 390px mobile web', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  try {
    await login(page);
    await openSettingsFromAccountMenu(page);
    await assertSettingsHub(page);
    await expect(page.getByRole('button', { name: 'Luxy.Love — về Tìm kiếm' }).getByText('Luxy', { exact: true })).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await page.getByTestId('settings-verification').click();
    await expect(page.getByTestId('luxy-verification-settings')).toBeVisible();
    for (const name of ['Bật camera & chụp selfie', 'Upload mặt trước CCCD', 'Upload mặt sau CCCD']) {
      const button = page.getByRole('button', { name });
      await expect(button).toBeVisible();
      const box = await button.boundingBox();
      expect(box).not.toBeNull();
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await assertNoHorizontalOverflow(page);

    await page.goto('/settings/private-photos');
    const uploadButton = page.getByTestId('private-photo-upload');
    await expect(uploadButton).toBeVisible();
    const uploadBox = await uploadButton.boundingBox();
    expect(uploadBox).not.toBeNull();
    expect(uploadBox.height).toBeGreaterThanOrEqual(44);
    await assertNoHorizontalOverflow(page);

    await testInfo.attach('web-r01-settings-390', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  } finally {
    await context.close();
  }
});