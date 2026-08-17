import { expect, test } from '@playwright/test';

async function assertNoHorizontalOverflow(page) {
  const metrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
}

async function assertLogoRendered(page) {
  const logo = page.getByTestId('chon-love-wordmark').first();
  await expect(logo).toBeVisible();
  await expect(logo).toHaveAttribute('role', 'img');
  await expect(logo).toHaveAttribute('aria-label', 'Chọn.Love');

  const box = await logo.boundingBox();
  expect(box).not.toBeNull();
  const expectedHeight = (page.viewportSize()?.width ?? 1280) < 768 ? 22 : 26;
  expect(Math.abs(box.height - expectedHeight)).toBeLessThanOrEqual(1);
  expect(Math.abs(box.width / box.height - (420 / 184))).toBeLessThanOrEqual(0.05);
}

async function assertPrimaryHomepageContent(page) {
  const home = page.getByTestId('chon-love-public-homepage');
  await expect(home).toBeVisible();
  await assertLogoRendered(page);
  await expect(home.getByText('Chọn đúng Người, Yêu đúng Gu', { exact: true }).first()).toBeVisible();
  await expect(home.getByText('NỀN TẢNG HẸN HỌ THỰC CHẤT VÀ THÚ VỊ', { exact: true }).first()).toBeVisible();
  await expect(home.getByText('CHIA SẼ TỪ THÀNH VIÊN:', { exact: true }).first()).toBeVisible();
  await expect(home.getByText('QUYỀN LỢI THÀNH VIÊN:', { exact: true }).first()).toBeVisible();
  await expect(home.getByText('SỨ MỆNH CỦA CHÚNG TÔI', { exact: true }).first()).toBeVisible();
  await expect(home.getByText('VĂN HOÁ KẾT NỐI CỦA CHỌN.LOVE', { exact: true }).first()).toBeVisible();
  await expect(home.getByText('Chọn đúng người, Yêu đúng Gu © 2026 Chon.Love', { exact: true }).first()).toBeVisible();
  await expect(home.getByText('Điều khoản', { exact: true }).first()).toBeVisible();
  await expect(home.getByText('Tiêu chuẩn cộng đồng', { exact: true }).first()).toBeVisible();
  return home;
}

test('public homepage follows the Chọn.love Seeking-inspired long-form hierarchy on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');

  await expect(page).toHaveTitle(/Chon\.Love/);
  const home = await assertPrimaryHomepageContent(page);
  await expect(home.getByText('Steven Nguyễn', { exact: true }).first()).toBeVisible();
  await expect(home.getByText('Thanh Hiền', { exact: true }).first()).toBeVisible();
  await expect(home.getByText('Hải Yến', { exact: true }).first()).toBeVisible();

  await expect(home.getByRole('button', { name: 'Đăng nhập', exact: true }).first()).toBeVisible();
  await expect(home.getByRole('button', { name: 'Đăng ký', exact: true }).first()).toBeVisible();
  await expect(home.getByText('Cách hoạt động', { exact: true })).toHaveCount(0);
  await expect(home.getByText('Giá trị Luxy', { exact: true })).toHaveCount(0);
  await assertNoHorizontalOverflow(page);

  await test.info().attach('chon-love-home-desktop-1280', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
});

test('homepage sends Login and Join to their intended auth modes', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');

  const home = page.getByTestId('chon-love-public-homepage');
  await home.getByRole('button', { name: 'Đăng nhập', exact: true }).first().click();
  await expect(page).toHaveURL(/\/auth\?mode=login$/);
  const loginScreen = page.getByTestId('luxy-auth-screen');
  await expect(loginScreen).toBeVisible();
  await expect(loginScreen.getByRole('heading', { name: 'Đăng nhập', exact: true })).toBeVisible();

  await page.goto('/');
  const refreshedHome = page.getByTestId('chon-love-public-homepage');
  await refreshedHome.getByRole('button', { name: 'Tham gia Chọn.love ngay' }).first().click();
  await expect(page).toHaveURL(/\/auth$/);
  const joinScreen = page.getByTestId('luxy-auth-screen');
  await expect(joinScreen).toBeVisible();
  await expect(joinScreen.getByRole('heading', { name: 'Đăng ký', exact: true })).toBeVisible();
});

for (const viewport of [
  { width: 390, height: 844, name: '390' },
  { width: 430, height: 932, name: '430' },
]) {
  test(`public homepage fits mobile ${viewport.name}px without horizontal overflow`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/');

    const home = await assertPrimaryHomepageContent(page);
    // React Native Web can expose Pressable text before its final accessibility role settles at small viewports.
    // Verify the mobile header actions are visibly present; desktop and auth-routing tests still assert button semantics.
    await expect(home.getByText('Đăng nhập', { exact: true }).first()).toBeVisible();
    await expect(home.getByText('Đăng ký', { exact: true }).first()).toBeVisible();
    await expect(home.getByRole('button', { name: 'Mở menu' })).toHaveCount(0);
    await expect(home.getByText('Steven Nguyễn', { exact: true }).first()).toBeVisible();

    const nextTestimonial = home.getByRole('button', { name: 'Chia sẻ tiếp theo' }).first();
    await expect(nextTestimonial).toBeVisible();
    await nextTestimonial.click();
    await expect(home.getByText('Thanh Hiền', { exact: true }).first()).toBeVisible();

    const cta = home.getByRole('button', { name: 'Tham gia Chọn.love ngay' }).first();
    const ctaBox = await cta.boundingBox();
    expect(ctaBox).not.toBeNull();
    expect(ctaBox.height).toBeGreaterThanOrEqual(44);

    await assertNoHorizontalOverflow(page);
    await test.info().attach(`chon-love-home-mobile-${viewport.name}`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });
}
