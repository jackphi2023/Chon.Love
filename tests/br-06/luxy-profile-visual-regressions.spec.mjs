import { expect, test } from '@playwright/test';

const password = process.env.BR06_E2E_PASSWORD || 'Br06-local-only-2026!';

async function login(page, expectedSearchTestId, email = 'br06.viewer@example.test') {
  await page.goto('/auth?mode=login');
  await page.getByPlaceholder('email@example.com').fill(email);
  await page.getByPlaceholder('Nhập mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập bằng email' }).click();
  await expect(page.getByTestId(expectedSearchTestId)).toBeVisible({ timeout: 30_000 });
}

async function openProfile(page) {
  await page.goto('/profile/br06_creator');
  await expect(page).toHaveURL(/\/thanh-vien\/id-[a-z0-9-]+/i, { timeout: 20_000 });
  await expect(page.getByTestId('chon-member-profile-page')).toBeVisible({ timeout: 20_000 });
}

async function expectNoHorizontalOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewport + 1);
}

async function expectFactTextReadable(page) {
  const labels = ['Chiều cao', 'Cân nặng', 'Tình trạng mối quan hệ', 'Giới tính', 'Con cái', 'Học vấn', 'Hút thuốc', 'Uống rượu bia', 'Nghề nghiệp'];
  const list = page.getByTestId('chon-member-profile-info-list');
  await expect(list).toBeVisible();
  const body = await list.innerText();
  let previous = -1;
  for (const label of labels) {
    const position = body.indexOf(label);
    expect(position).toBeGreaterThan(previous);
    previous = position;
  }
  const style = await list.getByText('Chiều cao', { exact: true }).evaluate((element) => getComputedStyle(element));
  expect(Number.parseFloat(style.fontSize)).toBeGreaterThanOrEqual(11.5);
}

test('UI-PRO01 desktop keeps compact 26px membership status badge, readable facts and stable profile composition', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  try {
    await login(page, 'luxy-search-desktop');
    await openProfile(page);

    const badge = page.getByTestId('chon-membership-badge-diamond').first();
    await expect(badge).toBeVisible();
    const badgeBox = await badge.boundingBox();
    expect(badgeBox).not.toBeNull();
    expect(badgeBox.width).toBeGreaterThanOrEqual(25);
    expect(badgeBox.width).toBeLessThanOrEqual(27);

    // BR-06 uses province_id=1, which maps to Hà Nội in the canonical province table.
    await expect(page.getByTestId('chon-profile-fact-location')).toContainText('Hà Nội');
    await expect(page.getByTestId('chon-profile-fact-member-since')).toContainText('Thành viên từ');
    await expectFactTextReadable(page);
    await expect(page.getByTestId('chon-member-profile-photo-grid')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await testInfo.attach('ui-pro01-desktop-profile-regression', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  } finally {
    await context.close();
  }
});

test('UI-PRO01 mobile keeps 16px membership badge, horizontal album and no overflow at 390px', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  try {
    await login(page, 'luxy-search-mobile', 'br06.outsider@example.test');
    await openProfile(page);

    const badge = page.getByTestId('chon-membership-badge-diamond').first();
    await expect(badge).toBeVisible();
    const badgeBox = await badge.boundingBox();
    expect(badgeBox).not.toBeNull();
    expect(badgeBox.width).toBeGreaterThanOrEqual(15);
    expect(badgeBox.width).toBeLessThanOrEqual(17);

    await expect(page.getByTestId('chon-member-profile-photo-strip')).toBeVisible();
    await expect(page.getByTestId('chon-private-photo-locked-tile')).toBeVisible();
    await expectFactTextReadable(page);
    await expectNoHorizontalOverflow(page);

    await testInfo.attach('ui-pro01-mobile-profile-regression', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  } finally {
    await context.close();
  }
});