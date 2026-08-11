import { expect, test } from '@playwright/test';

const password = process.env.BR06_E2E_PASSWORD || 'Br06-local-only-2026!';
const actor = { email: 'br06.viewer@example.test' };

async function login(page) {
  await page.goto('/');
  await expect(page.getByTestId('luxy-public-homepage')).toBeVisible();
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).first().click();
  await expect(page.getByText('Đăng nhập Beta', { exact: true })).toBeVisible();
  await page.getByPlaceholder('email@example.com').fill(actor.email);
  await page.getByPlaceholder('Nhập mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập bằng email' }).click();
  await expect(page.getByText('Khám phá', { exact: true }).first()).toBeVisible({ timeout: 30_000 });
}

async function expectNoHorizontalOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
}

async function expectPrimaryTouchTargets(page) {
  for (const label of ['Tìm kiếm', 'Yêu thích', 'Tin nhắn', 'Nâng cấp']) {
    const button = page.getByRole('button', { name: label, exact: true });
    await expect(button).toBeVisible();
    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
}

test('LX-04 responsive authenticated shell fits 390/430/768 without bottom tabs or horizontal overflow', async ({ browser }, testInfo) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  try {
    await login(page);

    // Compact phone: two-row shell, short brand and fixed four-item navigation.
    await expect(page.getByText('Nâng cấp ngay', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Luxy', { exact: true })).toBeVisible();
    await expectPrimaryTouchTargets(page);
    await expectNoHorizontalOverflow(page);

    const compactBrandBox = await page.getByText('Luxy', { exact: true }).boundingBox();
    const compactSearchBox = await page.getByRole('button', { name: 'Tìm kiếm', exact: true }).boundingBox();
    expect(compactBrandBox).not.toBeNull();
    expect(compactSearchBox).not.toBeNull();
    expect(compactBrandBox.y).toBeLessThan(compactSearchBox.y);

    await page.getByRole('button', { name: 'Mở menu tài khoản Luxy' }).click();
    await expect(page.getByRole('menu')).toBeVisible();
    const phoneMenuBox = await page.getByRole('menu').boundingBox();
    expect(phoneMenuBox).not.toBeNull();
    expect(phoneMenuBox.x).toBeGreaterThanOrEqual(0);
    expect(phoneMenuBox.x + phoneMenuBox.width).toBeLessThanOrEqual(390);
    await page.getByRole('button', { name: 'Mở menu tài khoản Luxy' }).click();

    await testInfo.attach('lx04-shell-390', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });

    // 430px phone: same two-row behavior, full Luxy.Love brand when there is room.
    await page.setViewportSize({ width: 430, height: 932 });
    await expect(page.getByText('Luxy.Love', { exact: true })).toBeVisible();
    await expect(page.getByText('Nâng cấp ngay', { exact: true })).toHaveCount(0);
    await expectPrimaryTouchTargets(page);
    await expectNoHorizontalOverflow(page);

    const phoneBrandBox = await page.getByText('Luxy.Love', { exact: true }).boundingBox();
    const phoneSearchBox = await page.getByRole('button', { name: 'Tìm kiếm', exact: true }).boundingBox();
    expect(phoneBrandBox).not.toBeNull();
    expect(phoneSearchBox).not.toBeNull();
    expect(phoneBrandBox.y).toBeLessThan(phoneSearchBox.y);

    await testInfo.attach('lx04-shell-430', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });

    // Tablet: a single restrained top row, still no desktop promo strip and no scroller.
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.getByText('Luxy', { exact: true })).toBeVisible();
    await expect(page.getByText('Nâng cấp ngay', { exact: true })).toHaveCount(0);
    await expectPrimaryTouchTargets(page);
    await expectNoHorizontalOverflow(page);

    const tabletBrandBox = await page.getByText('Luxy', { exact: true }).boundingBox();
    const tabletSearchBox = await page.getByRole('button', { name: 'Tìm kiếm', exact: true }).boundingBox();
    expect(tabletBrandBox).not.toBeNull();
    expect(tabletSearchBox).not.toBeNull();
    expect(Math.abs(tabletBrandBox.y - tabletSearchBox.y)).toBeLessThan(24);

    await testInfo.attach('lx04-shell-768', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });

    // LX-03 desktop boundary remains intact.
    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(page.getByText('Nâng cấp ngay', { exact: true })).toBeVisible();
    await expect(page.getByText('Luxy.Love', { exact: true })).toBeVisible();
  } finally {
    await context.close();
  }
});
