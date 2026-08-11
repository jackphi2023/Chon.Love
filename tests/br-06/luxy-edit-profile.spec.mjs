import { expect, test } from '@playwright/test';

const password = process.env.BR06_E2E_PASSWORD || 'Br06-local-only-2026!';
const actor = { email: 'br06.viewer@example.test' };

async function login(page) {
  await page.goto('/auth?mode=login');
  await expect(page.getByTestId('luxy-auth-screen')).toBeVisible();
  await page.getByPlaceholder('email@example.com').fill(actor.email);
  await page.getByPlaceholder('Nhập mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập bằng email' }).click();
  await expect(page.getByText('Tìm kiếm', { exact: true }).first()).toBeVisible({ timeout: 30_000 });
}

async function noHorizontalOverflow(page) {
  const metrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
}

async function assertCoreEditor(page) {
  await expect(page.getByTestId('lx08-edit-profile-page')).toBeVisible();
  await expect(page.getByTestId('lx08-photo-rail')).toBeVisible();
  await expect(page.getByTestId('lx08-profile-form')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Xem hồ sơ' })).toBeVisible();
  await expect(page.getByText('Tên hiển thị', { exact: true })).toBeVisible();
  await expect(page.getByText('Tiêu đề', { exact: true })).toBeVisible();
  await expect(page.getByText('Địa điểm chính', { exact: true })).toBeVisible();
  await expect(page.getByText('Địa điểm thứ hai', { exact: true })).toBeVisible();
  await expect(page.getByText('Địa điểm khác', { exact: true })).toBeVisible();
  await expect(page.getByText('Chiều cao', { exact: true })).toBeVisible();
  await expect(page.getByText('Cân nặng', { exact: true })).toBeVisible();
  await expect(page.getByText('Tình trạng quan hệ', { exact: true })).toBeVisible();
  await expect(page.getByText('Con cái', { exact: true })).toBeVisible();
  await expect(page.getByText('Bạn có hút thuốc?', { exact: true })).toBeVisible();
  await expect(page.getByText('Bạn có uống rượu/bia?', { exact: true })).toBeVisible();
  await expect(page.getByText('Học vấn', { exact: true })).toBeVisible();
  await expect(page.getByText('Nghề nghiệp', { exact: true })).toBeVisible();
  await expect(page.getByText('Giới thiệu về bạn', { exact: true })).toBeVisible();
  await expect(page.getByText('Tôi đang tìm kiếm', { exact: true })).toBeVisible();
  await expect(page.getByText('Bạn quan tâm đến', { exact: true })).toBeVisible();
  await expect(page.getByText('Độ tuổi mong muốn', { exact: true })).toBeVisible();
  await expect(page.getByText('Luxy tags', { exact: true })).toBeVisible();
  await expect(page.getByText('Xác minh', { exact: true })).toBeVisible();
}

test('LX-08 desktop edit profile follows Seeking two-column hierarchy', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  try {
    await login(page);
    await page.goto('/profile/edit');
    await assertCoreEditor(page);

    await expect(page.getByText('Nâng cấp ngay', { exact: true })).toBeVisible();
    const photoBox = await page.getByTestId('lx08-photo-rail').boundingBox();
    const formBox = await page.getByTestId('lx08-profile-form').boundingBox();
    expect(photoBox).not.toBeNull();
    expect(formBox).not.toBeNull();
    expect(formBox.x).toBeGreaterThan(photoBox.x + photoBox.width - 4);
    expect(photoBox.width).toBeGreaterThan(330);
    expect(photoBox.width).toBeLessThan(430);

    const locationButton = page.getByRole('button', { name: 'Chọn địa điểm chính' });
    await expect(locationButton).toBeVisible();
    await locationButton.click();
    await expect(page.getByLabel('Tìm tỉnh thành')).toBeVisible();
    await locationButton.click();

    await noHorizontalOverflow(page);
    await testInfo.attach('lx08-edit-profile-1280', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  } finally {
    await context.close();
  }
});

test('LX-08 edit profile stacks cleanly on tablet and phone without bottom-tab regression', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 768, height: 1024 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  try {
    await login(page);
    await page.goto('/profile/edit');
    await assertCoreEditor(page);
    await expect(page.getByText('Nâng cấp ngay', { exact: true })).toHaveCount(0);

    let photoBox = await page.getByTestId('lx08-photo-rail').boundingBox();
    let formBox = await page.getByTestId('lx08-profile-form').boundingBox();
    expect(photoBox).not.toBeNull();
    expect(formBox).not.toBeNull();
    expect(formBox.y).toBeGreaterThan(photoBox.y);
    await noHorizontalOverflow(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('button', { name: 'Luxy.Love — về Tìm kiếm' }).getByText('Luxy', { exact: true })).toBeVisible();
    photoBox = await page.getByTestId('lx08-photo-rail').boundingBox();
    formBox = await page.getByTestId('lx08-profile-form').boundingBox();
    expect(photoBox).not.toBeNull();
    expect(formBox).not.toBeNull();
    expect(formBox.y).toBeGreaterThan(photoBox.y);
    await noHorizontalOverflow(page);

    const saveButton = page.getByTestId('lx08-save');
    const saveBox = await saveButton.boundingBox();
    expect(saveBox).not.toBeNull();
    expect(saveBox.height).toBeGreaterThanOrEqual(44);

    await testInfo.attach('lx08-edit-profile-390', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  } finally {
    await context.close();
  }
});