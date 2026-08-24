import { expect, test } from '@playwright/test';

const password = process.env.BR06_E2E_PASSWORD || 'Br06-local-only-2026!';
const creator = { username: 'br06_creator', displayName: 'BR06 Creator' };

async function login(page, email) {
  await page.goto('/auth?mode=login');
  await expect(page.getByTestId('luxy-auth-screen')).toBeVisible();
  await page.getByPlaceholder('email@example.com').fill(email);
  await page.getByPlaceholder('Nhập mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập bằng email' }).click();
  await expect(page.getByTestId('luxy-search-mobile')).toBeVisible({ timeout: 30_000 });
}

async function openCreator(page) {
  await page.goto(`/profile/${creator.username}`);
  await expect(page).toHaveURL(/\/thanh-vien\/id-[a-z0-9-]+/i, { timeout: 20_000 });
  await expect(page.getByTestId('chon-member-profile-page')).toBeVisible({ timeout: 20_000 });
}

test('UI-PRO01 canonical member profile uses Chon.Love owner, ordered facts and mobile horizontal album for Free', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  try {
    await login(page, 'br06.outsider@example.test');
    await openCreator(page);

    await expect(page.getByTestId('chon-member-profile-hero-photo')).toBeVisible();
    await expect(page.getByTestId(/chon-favorite-/)).toBeVisible();
    await expect(page.getByTestId('chon-membership-badge-diamond')).toBeVisible();
    const verification = page.getByTestId('chon-member-verification-badges');
    await expect(verification).toBeVisible();
    await expect(verification.getByRole('button', { name: /^(Đã|Chưa) xác thực ảnh chụp cá nhân$/ })).toBeVisible();
    await expect(verification.getByRole('button', { name: /^(Đã|Chưa) xác thực CCCD$/ })).toBeVisible();
    await expect(verification.getByRole('button', { name: /^(Đã|Chưa) xác thực LinkedIn$/ })).toBeVisible();

    const info = page.getByTestId('chon-member-profile-info-list');
    const labels = ['Chiều cao', 'Cân nặng', 'Tình trạng mối quan hệ', 'Giới tính', 'Con cái', 'Học vấn', 'Hút thuốc', 'Uống rượu bia', 'Nghề nghiệp'];
    const text = await info.innerText();
    let cursor = -1;
    for (const label of labels) {
      const next = text.indexOf(label);
      expect(next).toBeGreaterThan(cursor);
      cursor = next;
    }

    await expect(page.getByTestId('chon-member-profile-photo-strip')).toBeVisible();
    await expect(page.getByTestId('chon-private-photo-locked-tile')).toBeVisible();
    await expect(page.getByText('Ẩm thực cao cấp', { exact: true })).toBeVisible();
    await expect(page.getByText('Sẵn sàng du lịch', { exact: true })).toBeVisible();

    await testInfo.attach('ui-pro01-free-mobile', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });

    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.getByTestId('chon-member-profile-photo-grid')).toBeVisible();
    await testInfo.attach('ui-pro01-free-desktop', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  } finally {
    await context.close();
  }
});

test('UI-PRO01 Premium viewer sees private media while Diamond member badge remains a server-controlled status signal', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  try {
    await login(page, 'br06.viewer@example.test');
    await openCreator(page);
    await expect(page.getByTestId('chon-membership-badge-diamond')).toBeVisible();
    await expect(page.getByTestId('chon-private-photo-paid-tile')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('chon-private-photo-locked-tile')).toHaveCount(0);
  } finally {
    await context.close();
  }
});