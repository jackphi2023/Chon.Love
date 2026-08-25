import { expect, test } from '@playwright/test';

const password = process.env.BR06_E2E_PASSWORD || 'Br06-local-only-2026!';
const actor = { email: 'br06.viewer@example.test' };

async function login(page) {
  await page.goto('/auth?mode=login');
  await expect(page.getByTestId('luxy-auth-screen')).toBeVisible();
  await page.getByPlaceholder('email@example.com').fill(actor.email);
  await page.getByPlaceholder('Nhập mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập bằng email' }).click();
  await expect(page.getByText('Kết nối', { exact: true }).first()).toBeVisible({ timeout: 30_000 });
}

async function assertNoHorizontalOverflow(page) {
  const widths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
}

async function openSettingsFromAccountMenu(page) {
  const viewport = page.viewportSize();
  const accountButtonName = (viewport?.width ?? 0) >= 1024 ? 'Mở menu hồ sơ' : 'Mở menu hồ sơ Chọn.love';
  await page.getByRole('button', { name: accountButtonName, exact: true }).click();
  const settingsItem = page.getByRole('menuitem', { name: 'Cài đặt', exact: true });
  await expect(settingsItem).toBeVisible();
  await settingsItem.focus();
  await settingsItem.press('Enter');
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByTestId('chon-settings-page')).toBeVisible();
}

async function assertSettingsHub(page) {
  await expect(page.getByRole('heading', { name: 'Cài đặt' })).toBeVisible();
  await expect(page.getByTestId('settings-privacy-section')).toBeVisible();
  await expect(page.getByTestId('settings-profile-section')).toBeVisible();
  await expect(page.getByTestId('settings-verification-section')).toBeVisible();
  await expect(page.getByTestId('settings-membership-section')).toBeVisible();
  await expect(page.getByTestId('settings-gifts-section')).toBeVisible();
  await expect(page.getByTestId('settings-account-section')).toBeVisible();
  await expect(page.getByText('Ảnh riêng tư', { exact: true })).toBeVisible();
  await expect(page.getByText('Xác thực hồ sơ', { exact: true })).toBeVisible();
  await expect(page.getByText('Gói thành viên', { exact: true })).toBeVisible();
  await expect(page.getByText('Cài đặt quà tặng', { exact: true })).toBeVisible();
  await expect(page.getByText('Quyền riêng tư do bạn kiểm soát', { exact: true })).toHaveCount(0);
  await expect(page.getByText(/Luxy Web V1/i)).toHaveCount(0);

  const hideOnline = page.getByRole('switch', { name: 'Ẩn trạng thái online' });
  const hideFromListing = page.getByRole('switch', { name: 'Ẩn khỏi danh sách thành viên' });
  await expect(hideOnline).toBeVisible();
  await expect(hideOnline).toBeEnabled();
  await expect(hideFromListing).toBeVisible();
  await expect(hideFromListing).toBeDisabled();
}

async function assertVerificationControls(page) {
  await expect(page.getByRole('button', { name: 'Mở chụp selfie' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Upload mặt trước CCCD' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Upload mặt sau CCCD' })).toBeVisible();
  await expect(page.getByTestId('verification-identity-submit')).toBeDisabled();
}

async function assertPrivatePhotoSettings(page) {
  await expect(page.getByTestId('luxy-private-photo-settings')).toBeVisible();
  await expect(page.getByTestId('private-photo-library')).toBeVisible();
  await expect(page.getByText(/ảnh hồ sơ mới được tải lên ở trạng thái công khai/i)).toBeVisible();
  await expect(page.getByText(/Theo luồng Luxy V1/i)).toHaveCount(0);
  await expect(page.getByText(/Premium: xem ảnh riêng tư/i)).toBeVisible();
  await expect(page.getByText(/Diamond: xem ảnh riêng tư/i)).toBeVisible();
  await expect(page.getByText(/Free: chỉ thấy số lượng\/khu vực ảnh bị khóa/i)).toBeVisible();
}

test('UI-SET01 Settings owns privacy and stays clean on desktop', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  try {
    await login(page);
    await openSettingsFromAccountMenu(page);
    await assertSettingsHub(page);
    await assertNoHorizontalOverflow(page);

    await page.getByTestId('settings-membership').click();
    await expect(page.getByTestId('luxy-upgrade-billing')).toBeVisible();
    await expect(page.getByText('Premium', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Diamond', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Quyền riêng tư của gói hiện tại', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Ẩn trạng thái online', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Ẩn khỏi danh sách thành viên', { exact: true })).toHaveCount(0);

    await page.goto('/settings');
    await page.getByTestId('settings-verification').click();
    await expect(page.getByTestId('luxy-verification-settings')).toBeVisible();
    await assertVerificationControls(page);
    await assertNoHorizontalOverflow(page);

    await page.goto('/settings/private-photos');
    await assertPrivatePhotoSettings(page);
    await assertNoHorizontalOverflow(page);

    await page.goto('/settings/gifts');
    await expect(page.getByTestId('luxy-gift-settings')).toBeVisible();
    await expect(page.getByText('Tặng quà không mở ảnh riêng tư', { exact: false })).toBeVisible();

    await testInfo.attach('ui-set01-settings-1280', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  } finally {
    await context.close();
  }
});

test('UI-SET01 Settings remains usable on 390px mobile web', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  try {
    await login(page);
    await openSettingsFromAccountMenu(page);
    await assertSettingsHub(page);
    const mobileBrand = page.getByRole('button', { name: 'Chọn.love — về Kết nối' });
    await expect(mobileBrand).toBeVisible();
    const mobileBrandBox = await mobileBrand.boundingBox();
    expect(mobileBrandBox).not.toBeNull();
    expect(mobileBrandBox.height).toBeGreaterThan(0);
    await assertNoHorizontalOverflow(page);

    await page.getByTestId('settings-verification').click();
    await expect(page.getByTestId('luxy-verification-settings')).toBeVisible();
    await assertVerificationControls(page);
    for (const name of ['Mở chụp selfie', 'Upload mặt trước CCCD', 'Upload mặt sau CCCD']) {
      const button = page.getByRole('button', { name });
      const box = await button.boundingBox();
      expect(box).not.toBeNull();
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await assertNoHorizontalOverflow(page);

    await page.goto('/settings/private-photos');
    await assertPrivatePhotoSettings(page);
    await assertNoHorizontalOverflow(page);

    await testInfo.attach('ui-set01-settings-390', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  } finally {
    await context.close();
  }
});
