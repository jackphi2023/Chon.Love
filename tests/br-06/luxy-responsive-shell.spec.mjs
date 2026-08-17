import { expect, test } from '@playwright/test';

const password = process.env.BR06_E2E_PASSWORD || 'Br06-local-only-2026!';
const actor = { email: 'br06.outsider@example.test' };

async function login(page) {
  await page.goto('/auth?mode=login');
  await expect(page.getByTestId('luxy-auth-screen')).toBeVisible();
  await expect(page.getByText('Đăng nhập', { exact: true }).first()).toBeVisible();
  await page.getByLabel('Email', { exact: true }).fill(actor.email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập bằng email' }).click();
  await expect(page.getByTestId('luxy-search-mobile')).toBeVisible({ timeout: 30_000 });
}

async function expectNoHorizontalOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
}

async function expectPrimaryTouchTargets(page) {
  for (const label of ['Kết nối', 'Yêu thích', 'Tin nhắn', 'Nâng cấp']) {
    const button = page.getByRole('button', { name: label, exact: true });
    await expect(button).toBeVisible();
    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
}

async function expectFreeUpgradePrompt(page) {
  const promo = page.getByTestId('luxy-free-upgrade-promo');
  await expect(promo).toBeVisible();
  await expect(promo.getByText('Nâng cấp ngay', { exact: true })).toBeVisible();
}

async function expectChonLoveBrand(shellBrand, expectedHeight) {
  const logo = shellBrand.getByTestId('chon-love-wordmark');
  await expect(logo).toBeVisible();
  await expect(logo).toHaveAttribute('role', 'img');
  await expect(logo).toHaveAttribute('aria-label', 'Chọn.Love');
  const logoBox = await logo.boundingBox();
  expect(logoBox).not.toBeNull();
  expect(Math.abs(logoBox.height - expectedHeight)).toBeLessThanOrEqual(1);
  expect(Math.abs(logoBox.width / logoBox.height - (420 / 184))).toBeLessThanOrEqual(0.05);
}

test('authenticated Free shell keeps connection tabs responsive at 390/430/768 and desktop at 1024', async ({ browser }, testInfo) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  try {
    await login(page);
    const shellBrand = page.getByRole('button', { name: 'Chọn.love — về Kết nối' });

    await expectChonLoveBrand(shellBrand, 22);
    await expectFreeUpgradePrompt(page);
    await expectPrimaryTouchTargets(page);
    await expectNoHorizontalOverflow(page);

    const compactBrandBox = await shellBrand.boundingBox();
    const compactConnectBox = await page.getByRole('button', { name: 'Kết nối', exact: true }).boundingBox();
    expect(compactBrandBox).not.toBeNull();
    expect(compactConnectBox).not.toBeNull();
    expect(compactBrandBox.y).toBeLessThan(compactConnectBox.y);

    await page.getByRole('button', { name: 'Mở menu tài khoản Chọn.love' }).click();
    await expect(page.getByRole('menu')).toBeVisible();
    const phoneMenuBox = await page.getByRole('menu').boundingBox();
    expect(phoneMenuBox).not.toBeNull();
    expect(phoneMenuBox.x).toBeGreaterThanOrEqual(0);
    expect(phoneMenuBox.x + phoneMenuBox.width).toBeLessThanOrEqual(390);
    await page.getByRole('button', { name: 'Mở menu tài khoản Chọn.love' }).click();

    await testInfo.attach('free-shell-390', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });

    await page.setViewportSize({ width: 430, height: 932 });
    await expectChonLoveBrand(shellBrand, 22);
    await expectFreeUpgradePrompt(page);
    await expectPrimaryTouchTargets(page);
    await expectNoHorizontalOverflow(page);

    const phoneBrandBox = await shellBrand.boundingBox();
    const phoneConnectBox = await page.getByRole('button', { name: 'Kết nối', exact: true }).boundingBox();
    expect(phoneBrandBox).not.toBeNull();
    expect(phoneConnectBox).not.toBeNull();
    expect(phoneBrandBox.y).toBeLessThan(phoneConnectBox.y);

    await testInfo.attach('free-shell-430', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });

    await page.setViewportSize({ width: 768, height: 1024 });
    await expectChonLoveBrand(shellBrand, 26);
    await expectFreeUpgradePrompt(page);
    await expectPrimaryTouchTargets(page);
    await expectNoHorizontalOverflow(page);

    const tabletBrandBox = await shellBrand.boundingBox();
    const tabletConnectBox = await page.getByRole('button', { name: 'Kết nối', exact: true }).boundingBox();
    expect(tabletBrandBox).not.toBeNull();
    expect(tabletConnectBox).not.toBeNull();
    expect(Math.abs(tabletBrandBox.y - tabletConnectBox.y)).toBeLessThan(24);

    await testInfo.attach('free-shell-768', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });

    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(page.getByTestId('chon-desktop-navigation')).toBeVisible();
    await expect(page.getByTestId('luxy-free-upgrade-promo')).toBeVisible();
    const desktopBrand = page.getByRole('button', { name: 'Chon.Love — về Kết nối' });
    await expect(desktopBrand).toBeVisible();
    await expectChonLoveBrand(desktopBrand, 26);
    await expect(page.getByRole('button', { name: 'Kết nối', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Chọn.love — về Kết nối' })).toHaveCount(0);
  } finally {
    await context.close();
  }
});
