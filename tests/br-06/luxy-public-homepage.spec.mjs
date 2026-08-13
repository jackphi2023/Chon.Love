import { expect, test } from '@playwright/test';

async function assertNoHorizontalOverflow(page) {
  const metrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
}

async function assertPrimaryHomepageContent(page) {
  await expect(page.getByTestId('luxy-public-homepage')).toBeVisible();
  await expect(page.getByText('Hẹn hò với người làm cuộc sống tốt đẹp hơn.')).toBeVisible();
  await expect(page.getByText('Tư duy Luxy')).toBeVisible();
  await expect(page.getByText('Câu chuyện thành viên')).toBeVisible();
  await expect(page.getByText('Vì sao hẹn hò trên Luxy')).toBeVisible();
  await expect(page.getByText('Sứ mệnh của Luxy')).toBeVisible();
  await expect(page.getByText('Giá trị của Luxy')).toBeVisible();
  await expect(page.getByText('Miễn phí tạo tài khoản')).toBeVisible();
  await expect(page.getByText('© 2026 Luxy.Love. Bảo lưu mọi quyền.')).toBeVisible();
}

test('LX-05 public homepage follows the Seeking-derived long-form hierarchy on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');

  await expect(page).toHaveTitle(/Luxy\.Love/);
  await assertPrimaryHomepageContent(page);
  await expect(page.getByText('Giới thiệu', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Cách hoạt động', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('An toàn', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Giá trị Luxy', { exact: true }).first()).toBeVisible();
  await assertNoHorizontalOverflow(page);

  await test.info().attach('lx05-home-desktop-1280', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
});

test('LX-06 homepage sends Login and Join to their intended auth modes', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');

  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).first().click();
  await expect(page).toHaveURL(/\/auth\?mode=login$/);
  const loginScreen = page.getByTestId('luxy-auth-screen');
  await expect(loginScreen).toBeVisible();
  await expect(loginScreen.getByRole('heading', { name: 'Đăng nhập', exact: true })).toBeVisible();

  await page.goto('/');
  await page.getByRole('button', { name: 'Tham gia Luxy.Love ngay' }).click();
  await expect(page).toHaveURL(/\/auth$/);
  const joinScreen = page.getByTestId('luxy-auth-screen');
  await expect(joinScreen).toBeVisible();
  await expect(joinScreen.getByRole('heading', { name: 'Đăng ký', exact: true })).toBeVisible();
});

for (const viewport of [
  { width: 390, height: 844, name: '390' },
  { width: 430, height: 932, name: '430' },
]) {
  test(`LX-05 public homepage fits mobile ${viewport.name}px without horizontal overflow`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/');

    await assertPrimaryHomepageContent(page);
    await expect(page.getByRole('button', { name: 'Mở menu' })).toBeVisible();
    await expect(page.getByText('Đăng nhập', { exact: true }).first()).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await page.getByRole('button', { name: 'Mở menu' }).click();
    await expect(page.getByText('Giới thiệu', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Cách hoạt động', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('An toàn', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Giá trị Luxy', { exact: true }).first()).toBeVisible();

    const cta = page.getByRole('button', { name: 'Tham gia Luxy.Love ngay' });
    const ctaBox = await cta.boundingBox();
    expect(ctaBox).not.toBeNull();
    expect(ctaBox.height).toBeGreaterThanOrEqual(44);

    await assertNoHorizontalOverflow(page);
    await test.info().attach(`lx05-home-mobile-${viewport.name}`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });
}
