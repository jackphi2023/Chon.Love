import { expect, test } from '@playwright/test';

const password = process.env.BR06_E2E_PASSWORD || 'Br06-local-only-2026!';
const actor = { email: 'br06.viewer@example.test' };

async function login(page) {
  await page.goto('/auth?mode=login');
  await expect(page.getByTestId('luxy-auth-screen')).toBeVisible();
  await page.getByPlaceholder('email@example.com').fill(actor.email);
  await page.getByPlaceholder('Nhập mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập bằng email' }).click();
  await expect(page.getByTestId('luxy-search-desktop')).toBeVisible({ timeout: 30_000 });
}

async function expectNoHorizontalOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
}

test('LX-10 desktop Search follows Seeking rail + 3-column photo-grid hierarchy', async ({ browser }, testInfo) => {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  try {
    await login(page);

    const rail = page.getByTestId('luxy-search-filter-rail');
    const results = page.getByTestId('luxy-search-results');
    await expect(rail).toBeVisible();
    await expect(results).toBeVisible();
    await expect(rail.getByText('Bộ lọc tìm kiếm', { exact: true })).toBeVisible();

    for (const label of [
      'Khu vực',
      'Khoảng cách',
      'Tùy chọn',
      'Tuổi',
      'Thành viên đang tìm',
      'Cân nặng',
      'Tình trạng quan hệ',
      'Chiều cao',
      'Hút thuốc',
      'Uống rượu/bia',
      'Học vấn',
      'Con cái',
      'Ngôn ngữ',
      'Nghề nghiệp',
      'Tìm trong hồ sơ',
    ]) {
      await expect(rail.getByText(label, { exact: true })).toBeVisible();
    }

    await expect(rail.getByRole('button', { name: 'Xem kết quả', exact: true }).first()).toBeVisible();
    await expect(rail.getByText('Lưu tìm kiếm', { exact: true }).first()).toBeVisible();
    await expect(rail.getByRole('button', { name: 'Đặt lại', exact: true }).first()).toBeVisible();
    await expect(rail.getByText('Đã xác thực ảnh', { exact: true })).toBeVisible();
    await expect(rail.getByText('Đã xác thực CCCD', { exact: true })).toBeVisible();
    await expect(rail.getByText('LX-20', { exact: true }).first()).toBeVisible();
    await expect(rail.getByText('LX-12', { exact: true }).first()).toBeVisible();

    const sortLabel = results.getByText('Gần nhất', { exact: true });
    await expect(sortLabel).toBeVisible();
    await sortLabel.click();
    const recentSort = results.getByText('Hoạt động gần đây', { exact: true });
    await expect(recentSort).toBeVisible();
    await recentSort.click();
    await expect(results.getByText('Hoạt động gần đây', { exact: true })).toBeVisible();

    const cards = page.getByTestId('luxy-search-member-card');
    await expect.poll(async () => cards.count(), { timeout: 30_000 }).toBeGreaterThanOrEqual(3);

    const first = await cards.nth(0).boundingBox();
    const second = await cards.nth(1).boundingBox();
    const third = await cards.nth(2).boundingBox();
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(third).not.toBeNull();
    expect(Math.abs(first.y - second.y)).toBeLessThan(3);
    expect(Math.abs(first.y - third.y)).toBeLessThan(3);
    expect(second.x).toBeGreaterThan(first.x);
    expect(third.x).toBeGreaterThan(second.x);

    const railBox = await rail.boundingBox();
    const resultsBox = await results.boundingBox();
    expect(railBox).not.toBeNull();
    expect(resultsBox).not.toBeNull();
    expect(railBox.x).toBeLessThan(resultsBox.x);
    expect(railBox.width).toBeGreaterThanOrEqual(340);
    expect(railBox.width).toBeLessThanOrEqual(370);
    await expectNoHorizontalOverflow(page);

    await testInfo.attach('lx10-search-desktop-1280', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });

    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(page.getByTestId('luxy-search-desktop')).toBeVisible();
    await expect(page.getByTestId('luxy-search-filter-rail')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.setViewportSize({ width: 1023, height: 768 });
    await expect(page.getByTestId('luxy-search-desktop')).toHaveCount(0);
    await expect(page.getByTestId('luxy-search-mobile')).toBeVisible();
    await expect(page.getByTestId('luxy-search-mobile-grid')).toBeVisible();
    await expectNoHorizontalOverflow(page);
  } finally {
    await context.close();
  }
});