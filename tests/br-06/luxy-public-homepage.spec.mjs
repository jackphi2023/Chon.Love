import { expect, test } from '@playwright/test';

async function assertNoHorizontalOverflow(page) {
  const metrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
}

async function assertPrimaryHomepageContent(page) {
  await expect(page.getByTestId('chon-love-public-homepage')).toBeVisible();
  await expect(page.getByText('Chọn đúng Người, Yêu đúng Gu', { exact: true })).toBeVisible();
  await expect(page.getByText('NỀN TẢNG HẸN HỌ THỰC CHẤT VÀ THÚ VỊ', { exact: true })).toBeVisible();
  await expect(page.getByText('CHIA SẼ TỪ THÀNH VIÊN:', { exact: true })).toBeVisible();
  await expect(page.getByText('QUYỀN LỢI THÀNH VIÊN:', { exact: true })).toBeVisible();
  await expect(page.getByText('SỨ MỆNH CỦA CHÚNG TÔI', { exact: true })).toBeVisible();
  await expect(page.getByText('VĂN HOÁ KẾT NỐI CỦA CHỌN.LOVE', { exact: true })).toBeVisible();
  await expect(page.getByText('Chọn đúng người, Yêu đúng Gu © 2026 Chon.Love', { exact: true })).toBeVisible();
  await expect(page.getByText('Điều khoản', { exact: true })).toBeVisible();
  await expect(page.getByText('Tiêu chuẩn cộng đồng', { exact: true })).toBeVisible();
}

test('public homepage follows the Chọn.love Seeking-inspired long-form hierarchy on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');

  await expect(page).toHaveTitle(/Chon\.Love/);
  await assertPrimaryHomepageContent(page);
  await expect(page.getByText('Steven Nguyễn', { exact: true })).toBeVisible();
  await expect(page.getByText('Thanh Hiền', { exact: true })).toBeVisible();
  await expect(page.getByText('Hải Yến', { exact: true })).toBeVisible();

  await expect(page.getByRole('button', { name: 'Đăng nhập', exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Đăng ký', exact: true }).first()).toBeVisible();
  await expect(page.getByText('Cách hoạt động', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Giá trị Luxy', { exact: true })).toHaveCount(0);
  await assertNoHorizontalOverflow(page);

  await test.info().attach('chon-love-home-desktop-1280', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
});

test('homepage sends Login and Join to their intended auth modes', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');

  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).first().click();
  await expect(page).toHaveURL(/\/auth\?mode=login$/);
  const loginScreen = page.getByTestId('luxy-auth-screen');
  await expect(loginScreen).toBeVisible();
  await expect(loginScreen.getByRole('heading', { name: 'Đăng nhập', exact: true })).toBeVisible();

  await page.goto('/');
  await page.getByRole('button', { name: 'Tham gia Chọn.love ngay' }).click();
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

    await assertPrimaryHomepageContent(page);
    await expect(page.getByRole('button', { name: 'Đăng nhập', exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Đăng ký', exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mở menu' })).toHaveCount(0);
    await expect(page.getByText('Steven Nguyễn', { exact: true })).toBeVisible();

    const nextTestimonial = page.getByRole('button', { name: 'Chia sẻ tiếp theo' });
    await expect(nextTestimonial).toBeVisible();
    await nextTestimonial.click();
    await expect(page.getByText('Thanh Hiền', { exact: true })).toBeVisible();

    const cta = page.getByRole('button', { name: 'Tham gia Chọn.love ngay' });
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
