import { expect, test } from '@playwright/test';

const password = process.env.BR06_E2E_PASSWORD || 'Br06-local-only-2026!';
const actor = { email: 'br06.viewer@example.test' };

async function expectNoHorizontalOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
}

test('LX-06 Seeking-style join flow keeps preference hierarchy and 18+ handoff', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  try {
    await page.goto('/(auth)');
    await expect(page.getByTestId('luxy-auth-screen')).toBeVisible();
    await expect(page.getByText('Đăng ký', { exact: true })).toBeVisible();
    await expect(page.getByText('Tôi là...', { exact: true })).toBeVisible();
    await expect(page.getByText('Quan tâm đến...', { exact: true })).toBeVisible();
    await expect(page.getByText(/chỉ dành cho người từ đủ 18 tuổi/i)).toBeVisible();

    await page.getByRole('radio', { name: 'Nam', exact: true }).first().click();
    await page.getByRole('radio', { name: 'Nữ', exact: true }).last().click();
    await page.getByRole('button', { name: 'Tiếp tục đăng ký' }).click();

    await expect(page.getByText('Tạo tài khoản', { exact: true }).first()).toBeVisible();
    await expect(page.getByPlaceholder('email@example.com')).toBeVisible();
    await expect(page.getByPlaceholder('Tối thiểu 10 ký tự')).toBeVisible();
    await expect(page.getByText(/xác minh 18\+/i)).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await testInfo.attach('lx06-signup-1280', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  } finally {
    await context.close();
  }
});

test('LX-06 login reuses existing email auth and remains responsive at 390px', async ({ browser }, testInfo) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  try {
    await page.goto('/(auth)?mode=login');
    await expect(page.getByTestId('luxy-auth-screen')).toBeVisible();
    await expect(page.getByText('Đăng nhập', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tham gia', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Quên mật khẩu' })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.getByPlaceholder('email@example.com').fill(actor.email);
    await page.getByPlaceholder('Nhập mật khẩu').fill(password);
    await page.getByRole('button', { name: 'Đăng nhập bằng email' }).click();
    await expect(page.getByText('Khám phá', { exact: true }).first()).toBeVisible({ timeout: 30_000 });

    await testInfo.attach('lx06-login-390-authenticated', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  } finally {
    await context.close();
  }
});
