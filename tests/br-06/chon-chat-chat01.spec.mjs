import { expect, test } from '@playwright/test';

const password = process.env.BR06_E2E_PASSWORD || 'Br06-local-only-2026!';
const viewer = { email: 'br06.viewer@example.test' };
const creator = { username: 'br06_creator', displayName: 'BR06 Creator' };

async function login(page) {
  await page.goto('/auth?mode=login');
  await expect(page.getByTestId('luxy-auth-screen')).toBeVisible();
  await page.getByPlaceholder('email@example.com').fill(viewer.email);
  await page.getByPlaceholder('Nhập mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập bằng email' }).click();
  await expect(page.getByTestId('luxy-search-mobile')).toBeVisible({ timeout: 30_000 });
}

test('UI-CHAT01 keeps conversation chrome clean and uses the shared gift composer action', async ({ browser }, testInfo) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const message = `UI-CHAT01 own bubble ${Date.now()}`;

  try {
    await login(page);
    await page.goto(`/profile/${creator.username}`);
    await expect(page).toHaveURL(/\/thanh-vien\/id-[0-9a-f]{6}$/i, { timeout: 20_000 });
    await expect(page.getByTestId('chon-member-profile-page')).toBeVisible();
    await page.getByRole('button', { name: `Gửi tin nhắn cho ${creator.displayName}`, exact: true }).click();

    await expect(page).toHaveURL(/\/chat\/[0-9a-f-]{36}$/i);
    await expect(page.getByTestId('chon-chat-header')).toBeVisible();
    await expect(page.getByTestId('chon-chat-header').getByRole('button', { name: 'Chặn', exact: true })).toHaveCount(0);
    await expect(page.getByTestId('chon-chat-header').getByRole('button', { name: 'Bỏ chặn', exact: true })).toHaveCount(0);

    const retentionCard = page.getByTestId('chon-chat-retention-card');
    await expect(retentionCard).toBeVisible();
    await expect(retentionCard.getByText('Tự động xoá sau 7 ngày', { exact: true })).toBeVisible();
    await expect(retentionCard.getByText(/Đang (bật cho cả hai người|tắt cho cuộc trò chuyện này)\./)).toBeVisible();

    const giftButton = page.getByTestId('chon-chat-gift-button');
    await expect(giftButton).toBeVisible();
    await expect(giftButton).toContainText('Tặng quà');
    await giftButton.click();
    await expect(page.getByText('Tặng quà', { exact: true }).first()).toBeVisible();
    await page.getByLabel('Đóng', { exact: true }).click();

    const chatInput = page.getByRole('textbox', { name: 'Nội dung tin nhắn', exact: true });
    await chatInput.fill(message);
    await page.getByRole('button', { name: 'Gửi', exact: true }).click();
    await expect(page.getByText(message, { exact: true }).last()).toBeVisible();

    const ownBubble = page.getByTestId('chon-chat-own-bubble').filter({ hasText: message }).last();
    await expect(ownBubble).toBeVisible();
    const backgroundColor = await ownBubble.evaluate((node) => getComputedStyle(node).backgroundColor);
    expect(backgroundColor).toBe('rgb(250, 245, 242)');

    await testInfo.attach('ui-chat01-mobile-conversation', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  } finally {
    await context.close();
  }
});
