import { expect, test } from '@playwright/test';

// Presentation contract tests: all API responses are explicit synthetic fixtures.
// Database/Edge authorization and global ordering are separate mandatory gates.
const user = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'admin@example.test' };
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z1ioAAAAASUVORK5CYII=', 'base64');
const items = [
  { user_id: 'new', email: 'new@example.test', display_name: 'Mới nhất', signup_at: '2026-09-22T08:00:00Z' },
  { user_id: 'old', email: 'old@example.test', display_name: 'Cũ hơn', signup_at: '2026-09-01T08:00:00Z' },
].map((item) => ({ ...item, gender: 'male', profile_status: 'active', membership_tier: 'premium', discovery_enabled: true, reports_received: 0, blocks_received: 0 }));

async function fixtures(page, allowed = true) {
  await page.addInitScript(({ user }) => {
    localStorage.setItem('chonlove-admin-auth-v1', JSON.stringify({
      access_token: 'synthetic-admin-ui-token', refresh_token: 'synthetic-refresh', token_type: 'bearer',
      expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, user,
    }));
  }, { user });
  await page.route('https://admin-ui.example.test/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
    let data;
    if (path === '/auth/v1/user') data = user;
    else if (path === '/rest/v1/rpc/is_super_admin') data = allowed;
    else if (path === '/rest/v1/rpc/admin_get_homepage_settings') data = { hero_desktop_youtube_url: null, hero_mobile_youtube_url: null, hero_slider_images: [], section2_left_image_url: null, section2_right_image_url: null, section3_background_image_url: null, section4_image_url: null, updated_at: '2026-09-22T00:00:00Z' };
    else if (path === '/auth/v1/logout') data = {};
    else if (path === '/functions/v1/user-admin') {
      const body = route.request().postDataJSON();
      if (body.action === 'list') data = { items };
      else if (body.action === 'listing_queue') data = { items: [] };
      else if (body.action === 'detail') data = { item: {
        account: { email: items[0].email, created_at: items[0].signup_at },
        profile: { profile_status: 'active' }, membership: { tier: 'premium' },
        share_profile_url: 'https://chon.love/thanh-vien/id-abc123',
        media: [{ id: 'avatar', visibility: 'avatar', moderation_status: 'approved', signed_url: 'https://admin-ui.example.test/storage/v1/object/sign/avatar', created_at: items[0].signup_at }],
        verification_selfies: [{ signed_url: 'https://admin-ui.example.test/storage/v1/object/sign/selfie', created_at: items[0].signup_at }],
      } };
      else throw new Error(`Unexpected Admin mutation: ${body.action}`);
    } else if (path.startsWith('/storage/')) return route.fulfill({ contentType: 'image/png', body: png, headers: { 'access-control-allow-origin': '*' } });
    else throw new Error(`Unexpected backend request: ${path}`);
    return route.fulfill({ json: data, headers: { 'access-control-allow-origin': '*' } });
  });
}

for (const width of [390, 430, 1280]) {
  test(`Admin Users signup time, media and actual profile link at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await fixtures(page);
    await page.goto('/admin/users/');
    const rows = page.locator('tbody tr');
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toContainText('new@example.test');
    await expect(rows.first().locator('time')).toHaveAttribute('datetime', items[0].signup_at);
    await expect(rows.first().locator('time')).toContainText('22/9/2026');
    await rows.first().getByRole('button', { name: 'Chi tiết', exact: true }).click();
    const share = page.getByRole('link', { name: 'Xem hồ sơ chia sẻ' });
    await expect(share).toHaveAttribute('href', 'https://chon.love/thanh-vien/id-abc123');
    await expect(share).toHaveAttribute('target', '_blank');
    await expect(page.getByRole('heading', { name: 'Ảnh hồ sơ (1)' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Selfie xác thực (1)' })).toBeVisible();
    const images = page.locator('figure img');
    await expect(images).toHaveCount(2);
    for (const img of await images.all()) await expect.poll(() => img.evaluate((node) => node.complete && node.naturalWidth > 0)).toBe(true);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await testInfo.attach(`admin-users-${width}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  });
}

test('ordinary member is denied Admin Users before protected content renders', async ({ page }) => {
  await fixtures(page, false);
  await page.goto('/admin/users/');
  await expect(page).toHaveURL(/\/admin\/login\/?$/);
  await expect(page.locator('tbody tr')).toHaveCount(0);
});

test('Admin rejects undersized Hero files before requesting an upload token', async ({ page }) => {
  await fixtures(page);
  await page.goto('/admin/homepage/');
  await page.getByRole('button', { name: '+ Thêm slide', exact: true }).click();
  await page.getByLabel('Upload Ảnh Desktop · ngang').setInputFiles({ name: 'tiny.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByText('Ảnh Desktop cần tối thiểu 1600 × 900 px, tỷ lệ 16:9 (sai lệch tối đa 5%).', { exact: true })).toBeVisible();
  await page.getByLabel('Upload Ảnh Mobile · dọc').setInputFiles({ name: 'tiny.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByText('Ảnh Mobile cần tối thiểu 1080 × 1920 px, tỷ lệ 9:16 (sai lệch tối đa 5%).', { exact: true })).toBeVisible();
});
