import { test, expect } from '@playwright/test';
import {
  assertNoHorizontalOverflow,
  loginAs,
  waitForAuthenticatedShell,
} from './helpers.mjs';

const creator = {
  email: 'br06.creator@example.test',
  password: process.env.BR06_E2E_PASSWORD,
};

async function assertSettingsHub(page) {
  await expect(page.getByTestId('luxy-settings-page')).toBeVisible();
  await expect(page.getByTestId('settings-profile')).toBeVisible();
  await expect(page.getByTestId('settings-private-photos')).toBeVisible();
  await expect(page.getByTestId('settings-verification')).toBeVisible();
  await expect(page.getByTestId('settings-membership')).toBeVisible();
  await expect(page.getByTestId('settings-gifts')).toBeVisible();
  await expect(page.getByTestId('settings-account')).toBeVisible();
  await expect(page.getByTestId('settings-safety')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await loginAs(page, creator);
  await waitForAuthenticatedShell(page);
});

test('LX-08 Settings hub covers profile-related cases on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/settings');
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
  await expect(page.getByText('Tặng quà không mở ảnh bảo mật', { exact: false })).toBeVisible();

  await page.goto('/settings/account');
  await expect(page.getByTestId('luxy-account-settings')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Đổi mật khẩu' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Xóa tài khoản' })).toBeVisible();

  await page.goto('/settings/safety');
  await expect(page.getByTestId('luxy-safety-settings')).toBeVisible();
  await expect(page.getByText('Chặn thành viên', { exact: false })).toBeVisible();
  await assertNoHorizontalOverflow(page);
});

test('LX-08 Settings remains usable on 390px mobile web', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/settings');
  await assertSettingsHub(page);
  await assertNoHorizontalOverflow(page);

  await page.getByTestId('settings-profile').click();
  await expect(page.getByTestId('luxy-edit-profile-page')).toBeVisible();
  await assertNoHorizontalOverflow(page);
});
