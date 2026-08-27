import { expect, test } from '@playwright/test';

const password = process.env.BR06_E2E_PASSWORD || 'Br06-local-only-2026!';
const outsider = { email: 'br06.outsider@example.test' };

async function login(page, expectedSearchTestId) {
  await page.goto('/auth?mode=login');
  await expect(page.getByTestId('luxy-auth-screen')).toBeVisible();
  await page.getByPlaceholder('email@example.com').fill(outsider.email);
  await page.getByPlaceholder('Nhập mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập bằng email' }).click();
  await expect(page.getByTestId(expectedSearchTestId)).toBeVisible({ timeout: 30_000 });
}

async function expectNoHorizontalOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewport + 1);
}

test('Profile Edit keeps height/weight full-width dropdowns and footer in normal document flow', async ({ browser }, testInfo) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  try {
    await login(page, 'luxy-search-mobile');
    await page.goto('/profile/edit');
    await expect(page.getByTestId('lx08-edit-profile-page')).toBeVisible({ timeout: 30_000 });

    const heightSelect = page.getByTestId('chon-profile-height-select');
    const weightSelect = page.getByTestId('chon-profile-weight-select');
    await expect(heightSelect).toBeVisible();
    await expect(weightSelect).toBeVisible();

    const controls = await page.evaluate(() => {
      const height = document.querySelector('[data-testid="chon-profile-height-select"]')?.getBoundingClientRect();
      const weight = document.querySelector('[data-testid="chon-profile-weight-select"]')?.getBoundingClientRect();
      return height && weight ? {
        heightLeft: height.left,
        heightRight: height.right,
        heightTop: height.top,
        weightLeft: weight.left,
        weightRight: weight.right,
        weightTop: weight.top,
      } : null;
    });
    expect(controls).not.toBeNull();
    expect(Math.abs(controls.heightLeft - controls.weightLeft)).toBeLessThanOrEqual(1);
    expect(Math.abs(controls.heightRight - controls.weightRight)).toBeLessThanOrEqual(1);
    expect(controls.weightTop).toBeGreaterThan(controls.heightTop);

    await heightSelect.click();
    await expect(page.getByText('160 cm', { exact: true })).toBeVisible();
    await page.getByLabel('Đóng danh sách').click();
    await weightSelect.click();
    await expect(page.getByText('60 kg', { exact: true })).toBeVisible();
    await page.getByLabel('Đóng danh sách').click();

    const footer = page.getByTestId('chon-my-profile-footer');
    const initialFooterState = await footer.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return { position: style.position, top: rect.top, viewportHeight: window.innerHeight };
    });
    expect(initialFooterState.position).not.toBe('fixed');
    expect(initialFooterState.position).not.toBe('sticky');
    expect(initialFooterState.top).toBeGreaterThan(initialFooterState.viewportHeight);

    await footer.scrollIntoViewIfNeeded();
    const finalFooterState = await footer.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, viewportHeight: window.innerHeight };
    });
    expect(finalFooterState.top).toBeLessThan(finalFooterState.viewportHeight);
    expect(finalFooterState.bottom).toBeGreaterThan(0);

    await expectNoHorizontalOverflow(page);
    await testInfo.attach('profile-edit-mobile-layout-footer', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  } finally {
    await context.close();
  }
});
