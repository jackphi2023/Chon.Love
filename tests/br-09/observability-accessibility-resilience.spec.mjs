import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const password = process.env.BR06_E2E_PASSWORD || 'Br06-local-only-2026!';
const viewerEmail = 'br06.viewer@example.test';
const chonWebTitle = 'Chon.Love | Chọn đúng người, Yêu đúng Gu';

async function openMobileLogin(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  await page.goto('/auth?mode=login');
  await expect(page.getByTestId('luxy-auth-screen')).toBeVisible();
  await expect(page.getByText('Đăng nhập', { exact: true }).first()).toBeVisible();
  await expect(page).toHaveTitle(chonWebTitle);
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
  return { context, page };
}

async function tabUntilFocused(page, locator, maxTabs = 8) {
  for (let index = 0; index < maxTabs; index += 1) {
    await page.keyboard.press('Tab');
    if (await locator.evaluate((element) => element === document.activeElement)) return;
  }
  await expect(locator).toBeFocused();
}

test('BR-09 mobile login is keyboard and screen-reader accessible', async ({ browser }, testInfo) => {
  const { context, page } = await openMobileLogin(browser);
  try {
    const emailInput = page.getByLabel('Email', { exact: true });
    const passwordInput = page.getByLabel('Mật khẩu', { exact: true });
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter((item) => item.impact === 'critical' || item.impact === 'serious');
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);

    const controls = [
      emailInput,
      passwordInput,
      page.getByRole('button', { name: 'Đăng nhập bằng email' }),
      page.getByRole('link', { name: 'Quên mật khẩu' }),
      page.getByRole('button', { name: 'Tiếp tục với Google' }),
    ];
    for (const control of controls) {
      await expect(control).toBeVisible();
      const box = await control.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }

    await tabUntilFocused(page, emailInput);
    await page.keyboard.press('Tab');
    await expect(passwordInput).toBeFocused();

    expect(await page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
    await testInfo.attach('br09-accessible-login', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  } finally {
    await context.close();
  }
});

test('BR-09 auth mutation fails once and never auto-retries', async ({ browser }) => {
  const { context, page } = await openMobileLogin(browser);
  const emailInput = page.getByLabel('Email', { exact: true });
  const passwordInput = page.getByLabel('Mật khẩu', { exact: true });
  let tokenRequests = 0;
  try {
    await page.route('**/auth/v1/token**', async (route) => {
      tokenRequests += 1;
      await route.abort('failed');
    });
    await emailInput.fill(viewerEmail);
    await passwordInput.fill(password);
    await page.getByRole('button', { name: 'Đăng nhập bằng email' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Đăng nhập bằng email' })).toBeEnabled();
    await page.waitForTimeout(1500);
    expect(tokenRequests).toBe(1);
  } finally {
    await context.close();
  }
});