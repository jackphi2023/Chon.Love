import { expect, test } from '@playwright/test';

const password = process.env.BR06_E2E_PASSWORD || 'Br06-local-only-2026!';
const creator = { email: 'br06.creator@example.test', displayName: 'BR06 Creator' };

async function login(page) {
  await page.goto('/auth?mode=login');
  await page.getByPlaceholder('email@example.com').fill(creator.email);
  await page.getByPlaceholder('Nhập mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập bằng email' }).click();
  await expect(page.getByTestId('luxy-search-desktop')).toBeVisible({ timeout: 30_000 });
}

test('UI-PRO02 /profile resolves to one Chon.Love editor with canonical public view/share contract', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  try {
    await login(page);
    await page.goto('/profile');
    await expect(page).toHaveURL(/\/profile\/edit$/);
    await expect(page.getByTestId('chon-my-profile-page')).toBeVisible();

    const publicUrl = page.getByTestId('chon-public-profile-url');
    await expect(publicUrl).toContainText(/^https:\/\/www\.chon\.love\/thanh-vien\/id-[0-9a-f]{6}$/i);
    await expect(page.getByTestId('chon-share-profile')).toBeVisible();
    await expect(page.getByTestId('chon-copy-profile-link')).toBeVisible();
    await expect(page.getByTestId('chon-profile-looking-for-tags')).toContainText('Mong muốn tìm kiếm');
    await expect(page.getByText('Ngôn ngữ', { exact: true })).toHaveCount(0);
    await expect(page.getByText(/Luxy\.Love/)).toHaveCount(0);

    const headline = page.getByLabel('Tiêu đề');
    await headline.fill('Ngắn');
    await page.getByTestId('lx08-save').click();
    await expect(page.getByRole('alert')).toContainText('10 đến 50 ký tự');

    const updatedHeadline = 'Kết nối chân thành và cùng phát triển';
    await headline.fill(updatedHeadline);
    await page.getByTestId('lx08-save').click();
    await expect(page.getByRole('alert')).toContainText('Đã lưu thay đổi hồ sơ Chọn.Love.');

    await page.getByTestId('lx08-view-profile').click();
    await expect(page).toHaveURL(/\/thanh-vien\/id-[0-9a-f]{6}$/i);
    await expect(page.getByTestId('chon-member-profile-page')).toBeVisible();
    await expect(page.getByText(updatedHeadline, { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: new RegExp(`^${creator.displayName},`) })).toBeVisible();

    await testInfo.attach('ui-pro02-my-profile-public-contract', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  } finally {
    await context.close();
  }
});

test('UI-PRO02 mobile My Profile keeps public link and editor controls without horizontal overflow', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await context.newPage();

  try {
    await page.goto('/auth?mode=login');
    await page.getByPlaceholder('email@example.com').fill(creator.email);
    await page.getByPlaceholder('Nhập mật khẩu').fill(password);
    await page.getByRole('button', { name: 'Đăng nhập bằng email' }).click();
    await expect(page.getByTestId('luxy-search-mobile')).toBeVisible({ timeout: 30_000 });

    await page.goto('/profile');
    await expect(page).toHaveURL(/\/profile\/edit$/);
    await expect(page.getByTestId('chon-my-profile-page')).toBeVisible();
    await expect(page.getByTestId('chon-public-profile-link-card')).toBeVisible();
    await expect(page.getByTestId('lx08-save')).toBeVisible();
    await expect(page.getByTestId('luxy-owned-photo-management')).toBeVisible();

    const dimensions = await page.evaluate(() => ({ viewport: window.innerWidth, documentWidth: document.documentElement.scrollWidth }));
    expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewport + 1);

    await testInfo.attach('ui-pro02-mobile-my-profile', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  } finally {
    await context.close();
  }
});
