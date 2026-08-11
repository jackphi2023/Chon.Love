import { expect, test } from '@playwright/test';

const password = process.env.BR06_E2E_PASSWORD || 'Br06-local-only-2026!';
const actor = { email: 'br06.viewer@example.test' };

async function login(page) {
  await page.goto('/auth?mode=login');
  await expect(page.getByTestId('luxy-auth-screen')).toBeVisible();
  await page.getByPlaceholder('email@example.com').fill(actor.email);
  await page.getByPlaceholder('Nhập mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập bằng email' }).click();
  await expect(page.getByTestId('luxy-search-mobile')).toBeVisible({ timeout: 30_000 });
}

async function noHorizontalOverflow(page) {
  const metrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
}

async function assertTwoColumnGrid(page) {
  const cards = page.getByTestId('luxy-search-mobile-card');
  await expect.poll(async () => cards.count(), { timeout: 30_000 }).toBeGreaterThanOrEqual(3);
  const first = await cards.nth(0).boundingBox();
  const second = await cards.nth(1).boundingBox();
  const third = await cards.nth(2).boundingBox();
  expect(first).not.toBeNull();
  expect(second).not.toBeNull();
  expect(third).not.toBeNull();
  expect(Math.abs(first.y - second.y)).toBeLessThan(3);
  expect(second.x).toBeGreaterThan(first.x);
  expect(third.y).toBeGreaterThan(first.y + 10);
  expect(Math.abs(first.width - second.width)).toBeLessThan(3);
}

test('LX-11 phone Search follows Seeking two-column grid + filter/sort sheets', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await context.newPage();

  try {
    await login(page);
    await expect(page.getByRole('heading', { name: 'Tìm kiếm' })).toBeVisible();
    await expect(page.getByTestId('luxy-search-mobile-grid')).toBeVisible();
    await assertTwoColumnGrid(page);

    const filterButton = page.getByTestId('luxy-search-mobile-filter-button');
    const sortButton = page.getByTestId('luxy-search-mobile-sort-button');
    await expect(filterButton).toBeVisible();
    await expect(sortButton).toBeVisible();
    for (const button of [filterButton, sortButton]) {
      const box = await button.boundingBox();
      expect(box).not.toBeNull();
      expect(box.height).toBeGreaterThanOrEqual(44);
    }

    await filterButton.click();
    const filterSheet = page.getByTestId('luxy-search-mobile-filter-sheet');
    await expect(filterSheet).toBeVisible();
    await expect(filterSheet.getByText('Bộ lọc tìm kiếm', { exact: true })).toBeVisible();
    await expect(filterSheet.getByText('Khu vực', { exact: true })).toBeVisible();
    await expect(filterSheet.getByText('Khoảng cách', { exact: true })).toBeVisible();
    await expect(filterSheet.getByText('Tùy chọn', { exact: true })).toBeVisible();
    await expect(filterSheet.getByText('Đã xác thực ảnh', { exact: true })).toBeVisible();
    await expect(filterSheet.getByText('LX-20', { exact: true }).first()).toBeVisible();
    await expect(filterSheet.getByText('LX-12', { exact: true }).first()).toBeVisible();

    const applyButton = page.getByTestId('luxy-search-mobile-filter-apply');
    const applyBox = await applyButton.boundingBox();
    expect(applyBox).not.toBeNull();
    expect(applyBox.height).toBeGreaterThanOrEqual(44);
    await applyButton.click();
    await expect(filterSheet).toHaveCount(0);

    await sortButton.click();
    const sortSheet = page.getByTestId('luxy-search-mobile-sort-sheet');
    await expect(sortSheet).toBeVisible();
    await expect(sortSheet.getByText('Gần nhất', { exact: true })).toBeVisible();
    const recent = page.getByTestId('luxy-search-mobile-sort-recent');
    await expect(recent).toBeVisible();
    await recent.click();
    await expect(sortSheet).toHaveCount(0);
    await expect(sortButton).toHaveAttribute('aria-label', 'Sắp xếp: Hoạt động gần đây');

    await noHorizontalOverflow(page);
    await testInfo.attach('lx11-search-mobile-390', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });

    await page.setViewportSize({ width: 430, height: 932 });
    await expect(page.getByTestId('luxy-search-mobile')).toBeVisible();
    await assertTwoColumnGrid(page);
    await noHorizontalOverflow(page);
    await testInfo.attach('lx11-search-mobile-430', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });

    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.getByTestId('luxy-search-mobile')).toBeVisible();
    await assertTwoColumnGrid(page);
    await noHorizontalOverflow(page);
    await testInfo.attach('lx11-search-mobile-768', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });

    await page.setViewportSize({ width: 1023, height: 768 });
    await expect(page.getByTestId('luxy-search-mobile')).toBeVisible();
    await expect(page.getByTestId('luxy-search-desktop')).toHaveCount(0);
    await noHorizontalOverflow(page);

    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(page.getByTestId('luxy-search-mobile')).toHaveCount(0);
    await expect(page.getByTestId('luxy-search-desktop')).toBeVisible();
    await noHorizontalOverflow(page);
  } finally {
    await context.close();
  }
});