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

async function expectControlFontAtLeast(page, locator, minimum = 16) {
  const fontSize = await locator.evaluate((element) => {
    const leafTextElements = [element, ...element.querySelectorAll('*')]
      .filter((candidate) => candidate.children.length === 0 && candidate.textContent?.trim());
    const candidates = leafTextElements.length ? leafTextElements : [element];
    return Math.max(...candidates.map((candidate) => Number.parseFloat(window.getComputedStyle(candidate).fontSize)));
  });
  expect(fontSize).toBeGreaterThanOrEqual(minimum);
}

test('LX-06 Seeking-style join flow keeps preference hierarchy and eligibility handoff', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  try {
    await page.goto('/auth');
    await expect(page.getByTestId('luxy-auth-screen')).toBeVisible();
    await expect(page.getByText('Đăng ký', { exact: true })).toBeVisible();
    await expect(page.getByText('Tôi là...', { exact: true })).toBeVisible();
    await expect(page.getByText('Quan tâm đến...', { exact: true })).toBeVisible();
    await expect(page.getByText(/dành cho người trưởng thành/i)).toBeVisible();

    await page.getByRole('radio', { name: 'Nam', exact: true }).first().click();
    await page.getByRole('radio', { name: 'Nữ', exact: true }).last().click();
    await page.getByRole('button', { name: 'Tiếp tục đăng ký' }).click();

    await expect(page.getByText('Tạo tài khoản', { exact: true }).first()).toBeVisible();
    await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Mật khẩu', { exact: true })).toBeVisible();
    await expect(page.getByText(/đồng ý với Điều khoản sử dụng và Tiêu chuẩn cộng đồng/i)).toBeVisible();
    await expectControlFontAtLeast(page, page.getByLabel('Email', { exact: true }));
    await expectControlFontAtLeast(page, page.getByLabel('Mật khẩu', { exact: true }));
    await expectControlFontAtLeast(page, page.getByRole('button', { name: 'Tạo tài khoản bằng email' }));
    await expectNoHorizontalOverflow(page);

    await testInfo.attach('lx06-signup-1280', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  } finally {
    await context.close();
  }
});

test('SU-10 signup shell stays responsive at 390, 768 and 1440 pixels', async ({ browser }) => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 900 },
    { width: 1440, height: 1000 },
  ]) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: viewport.width === 390 ? 2 : 1 });
    const page = await context.newPage();
    try {
      await page.goto('/auth');
      await expect(page.getByTestId('luxy-auth-screen')).toBeVisible();
      await expect(page.getByTestId('signup-auth-panel')).toBeVisible();
      await expectNoHorizontalOverflow(page);

      const panelBox = await page.getByTestId('signup-auth-panel').boundingBox();
      expect(panelBox).not.toBeNull();
      expect(panelBox.width).toBeLessThanOrEqual(viewport.width);

      const male = page.getByRole('radio', { name: 'Nam', exact: true }).first();
      await male.focus();
      await page.keyboard.press('Space');
      await expect(male).toHaveAttribute('aria-checked', 'true');

      const femaleInterest = page.getByRole('radio', { name: 'Nữ', exact: true }).last();
      await femaleInterest.focus();
      await page.keyboard.press('Space');
      await expect(femaleInterest).toHaveAttribute('aria-checked', 'true');

      const continueButton = page.getByRole('button', { name: 'Tiếp tục đăng ký' });
      await continueButton.focus();
      await page.keyboard.press('Enter');
      await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await expectControlFontAtLeast(page, page.getByLabel('Email', { exact: true }));
      await expectControlFontAtLeast(page, page.getByRole('button', { name: 'Tạo tài khoản bằng email' }));
    } finally {
      await context.close();
    }
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
    await page.goto('/auth?mode=login');
    await expect(page.getByTestId('luxy-auth-screen')).toBeVisible();
    await expect(page.getByText('Đăng nhập', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Đăng ký', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Quên mật khẩu' })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.getByLabel('Email', { exact: true }).fill(actor.email);
    await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Đăng nhập bằng email' }).click();
    await expect(page.getByTestId('luxy-search-mobile')).toBeVisible({ timeout: 30_000 });

    await testInfo.attach('lx06-login-390-authenticated', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  } finally {
    await context.close();
  }
});