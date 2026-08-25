import { expect, test } from '@playwright/test';

const password = process.env.BR06_E2E_PASSWORD || 'Br06-local-only-2026!';
const actor = { email: 'br06.viewer@example.test' };

async function expectNoHorizontalOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

async function login(page) {
  await page.goto('/auth?mode=login');
  await expect(page.getByTestId('luxy-auth-screen')).toBeVisible();
  await page.getByLabel('Email', { exact: true }).fill(actor.email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập bằng email' }).click();
  await expect(page.getByText('Kết nối', { exact: true }).first()).toBeVisible({ timeout: 30_000 });
}

test('UI-AUTH01 forgot password uses the shared Chon auth shell at 390, 430 and desktop', async ({ browser }) => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 430, height: 900 },
    { width: 1280, height: 900 },
  ]) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: viewport.width < 500 ? 2 : 1 });
    const page = await context.newPage();
    try {
      await page.goto('/auth/forgot-password');
      const screen = page.getByTestId('chon-forgot-password-screen');
      await expect(screen).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Khôi phục mật khẩu' })).toHaveCSS('color', 'rgb(184, 120, 0)');
      await expect(page.getByLabel('Email khôi phục mật khẩu')).toBeVisible();

      const submit = page.getByTestId('forgot-password-submit');
      await expect(submit).toBeDisabled();
      await expect(submit).toHaveCSS('background-color', 'rgb(217, 45, 42)');
      await expect(page.getByText('Lưu ý bảo mật', { exact: true })).toBeVisible();
      await expectNoHorizontalOverflow(page);
    } finally {
      await context.close();
    }
  }
});

test('UI-AUTH01 forgot password preserves the anti-enumeration success state', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 430, height: 900 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  try {
    await page.goto('/auth/forgot-password');
    await page.getByLabel('Email khôi phục mật khẩu').fill(actor.email);
    await page.getByTestId('forgot-password-submit').click();
    await expect(page.getByText('Kiểm tra hộp thư', { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/dù email có tồn tại hay không/i)).toBeVisible();
    await expect(page.getByTestId('forgot-password-back-login')).toBeEnabled();
    await expectNoHorizontalOverflow(page);
  } finally {
    await context.close();
  }
});

test('UI-AUTH01 reset password shares the shell and exposes client validation without mutating the account', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  try {
    await login(page);
    await page.goto('/auth/reset-password');
    await expect(page.getByTestId('chon-reset-password-screen')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'Đặt mật khẩu mới' })).toHaveCSS('color', 'rgb(184, 120, 0)');

    const nextPassword = page.getByLabel('Mật khẩu mới', { exact: true });
    const confirmation = page.getByLabel('Nhập lại mật khẩu mới', { exact: true });
    const submit = page.getByTestId('reset-password-submit');

    await expect(submit).toBeDisabled();
    await nextPassword.fill('short');
    await expect(page.getByText('Mật khẩu cần ít nhất 8 ký tự.', { exact: true })).toBeVisible();

    await nextPassword.fill('ChonLove-Auth01!');
    await confirmation.fill('ChonLove-Auth02!');
    await expect(page.getByText('Hai lần nhập mật khẩu chưa khớp.', { exact: true })).toBeVisible();
    await expect(submit).toBeDisabled();

    await confirmation.fill('ChonLove-Auth01!');
    await expect(submit).toBeEnabled();
    await expect(submit).toHaveCSS('background-color', 'rgb(217, 45, 42)');
    await expect(page.getByText('Bảo vệ tài khoản', { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  } finally {
    await context.close();
  }
});
