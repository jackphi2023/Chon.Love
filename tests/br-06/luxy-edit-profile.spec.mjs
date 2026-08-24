import { expect, test } from '@playwright/test';

const password = process.env.BR06_E2E_PASSWORD || 'Br06-local-only-2026!';
const actor = { email: 'br06.outsider@example.test' };

async function login(page, expectedSearchTestId) {
  await page.goto('/auth?mode=login');
  await expect(page.getByTestId('luxy-auth-screen')).toBeVisible();
  await page.getByPlaceholder('email@example.com').fill(actor.email);
  await page.getByPlaceholder('Nhập mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập bằng email' }).click();
  await expect(page.getByTestId(expectedSearchTestId)).toBeVisible({ timeout: 30_000 });
}

async function expectNoHorizontalOverflow(page) {
  const metrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
}

async function assertCanonicalEditor(page) {
  await expect(page.getByTestId('chon-my-profile-page')).toBeVisible();
  await expect(page.getByTestId('lx08-edit-profile-page')).toBeVisible();
  await expect(page.getByTestId('lx08-photo-rail')).toBeVisible();
  await expect(page.getByTestId('lx08-profile-form')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Xem hồ sơ' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Chia sẻ hồ sơ' })).toBeVisible();
  await expect(page.getByText('Tên hiển thị', { exact: true })).toBeVisible();
  await expect(page.getByText('Tiêu đề', { exact: true })).toBeVisible();
  await expect(page.getByText('Tỉnh / thành phố', { exact: true })).toBeVisible();
  await expect(page.getByText('Chiều cao', { exact: true })).toBeVisible();
  await expect(page.getByText('Cân nặng', { exact: true })).toBeVisible();
  await expect(page.getByText('Tình trạng mối quan hệ', { exact: true })).toBeVisible();
  await expect(page.getByText('Con cái', { exact: true })).toBeVisible();
  await expect(page.getByText('Hút thuốc', { exact: true })).toBeVisible();
  await expect(page.getByText('Uống rượu / bia', { exact: true })).toBeVisible();
  await expect(page.getByText('Học vấn', { exact: true })).toBeVisible();
  await expect(page.getByText('Nghề nghiệp', { exact: true })).toBeVisible();
  await expect(page.getByText('Giới thiệu về bạn', { exact: true })).toBeVisible();
  await expect(page.getByText('Tôi đang tìm kiếm', { exact: true })).toBeVisible();
  await expect(page.getByText('Bạn quan tâm đến', { exact: true })).toBeVisible();
  await expect(page.getByText('Độ tuổi mong muốn', { exact: true })).toBeVisible();
  await expect(page.getByText('Mong muốn tìm kiếm', { exact: true })).toBeVisible();
  await expect(page.getByText('Xác minh Chọn.Love', { exact: true })).toBeVisible();
  await expect(page.getByText('Ngôn ngữ', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Luxy tags', { exact: true })).toHaveCount(0);
}

test('legacy /profile entry resolves to the canonical two-column Chon.Love editor on desktop', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  try {
    await login(page, 'luxy-search-desktop');
    await page.goto('/profile');
    await expect(page).toHaveURL(/\/profile\/edit$/);
    await assertCanonicalEditor(page);

    await expect(page.getByTestId('chon-desktop-navigation')).toHaveCount(1);
    const photoBox = await page.getByTestId('lx08-photo-rail').boundingBox();
    const formBox = await page.getByTestId('lx08-profile-form').boundingBox();
    expect(photoBox).not.toBeNull();
    expect(formBox).not.toBeNull();
    expect(formBox.x).toBeGreaterThan(photoBox.x + photoBox.width - 4);
    expect(photoBox.width).toBeGreaterThan(330);
    expect(photoBox.width).toBeLessThan(410);

    const locationButton = page.getByRole('button', { name: 'Chọn tỉnh thành' });
    await expect(locationButton).toBeVisible();
    await locationButton.click();
    await expect(page.getByLabel('Tìm tỉnh thành')).toBeVisible();
    await locationButton.click();

    await expectNoHorizontalOverflow(page);
    await testInfo.attach('ui-pro02-editor-1280', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  } finally {
    await context.close();
  }
});

test('canonical editor stacks cleanly on mobile with a single Chon.Love chrome', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  try {
    await login(page, 'luxy-search-mobile');
    await page.goto('/profile/edit');
    await assertCanonicalEditor(page);

    const photoBox = await page.getByTestId('lx08-photo-rail').boundingBox();
    const formBox = await page.getByTestId('lx08-profile-form').boundingBox();
    expect(photoBox).not.toBeNull();
    expect(formBox).not.toBeNull();
    expect(formBox.y).toBeGreaterThan(photoBox.y);
    await expectNoHorizontalOverflow(page);

    const saveBox = await page.getByTestId('lx08-save').boundingBox();
    expect(saveBox).not.toBeNull();
    expect(saveBox.height).toBeGreaterThanOrEqual(44);

    await testInfo.attach('ui-pro02-editor-390', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  } finally {
    await context.close();
  }
});
