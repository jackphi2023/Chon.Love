import { expect, test } from '@playwright/test';

const password = process.env.BR06_E2E_PASSWORD || 'Br06-local-only-2026!';
const sender = {
  email: 'br06.viewer@example.test',
  username: 'br06_viewer',
  displayName: 'BR06 Viewer',
};
const recipient = {
  email: 'br06.creator@example.test',
  username: 'br06_creator',
  displayName: 'BR06 Creator',
};

async function createMobilePage(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  return { context, page: await context.newPage() };
}

async function login(page, actor) {
  await page.goto('/auth?mode=login');
  await expect(page.getByTestId('luxy-auth-screen')).toBeVisible();
  await page.getByPlaceholder('email@example.com').fill(actor.email);
  await page.getByPlaceholder('Nhập mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập bằng email' }).click();
  await expect(page.getByTestId('luxy-search-mobile')).toBeVisible({ timeout: 30_000 });
}

async function openChatWithRecipient(page) {
  await page.goto(`/profile/${recipient.username}`);
  await expect(page).toHaveURL(/\/thanh-vien\/id-[0-9a-f]{6}$/i, { timeout: 20_000 });
  await expect(page.getByTestId('chon-member-profile-page')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: `Gửi tin nhắn cho ${recipient.displayName}`, exact: true }).click();
  await expect(page).toHaveURL(/\/chat\/[0-9a-f-]{36}$/i, { timeout: 20_000 });
  await expect(page.getByTestId('chon-chat-header')).toBeVisible({ timeout: 20_000 });
}

async function sendMessage(page, message) {
  const input = page.getByRole('textbox', { name: 'Nội dung tin nhắn', exact: true });
  await input.fill(message);
  await page.getByRole('button', { name: 'Gửi', exact: true }).click();
  const ownBubble = page.getByTestId('chon-chat-own-bubble').filter({ hasText: message });
  await expect(ownBubble).toHaveCount(1, { timeout: 20_000 });
  await expect(ownBubble).toContainText(message);
  return ownBubble;
}

test('OPT-10 keeps mailbox, unread, chat delivery, read receipt, and reconnect recovery realtime', async ({ browser }, testInfo) => {
  const senderSession = await createMobilePage(browser);
  const recipientSession = await createMobilePage(browser);
  const senderPage = senderSession.page;
  const recipientPage = recipientSession.page;
  const suffix = Date.now();
  const liveMessage = `OPT-10 realtime ${suffix}`;
  const reconnectMessage = `OPT-10 reconnect ${suffix}`;

  try {
    await Promise.all([
      login(senderPage, sender),
      login(recipientPage, recipient),
    ]);

    // Mount the recipient mailbox and its global realtime bridge before the sender writes.
    await recipientPage.goto('/messages');
    await expect(recipientPage.getByTestId('luxy-messages-page')).toBeVisible({ timeout: 20_000 });
    const recipientNavMessages = recipientPage.getByRole('button', { name: 'Tin nhắn', exact: true });
    await expect(recipientNavMessages).toBeVisible();
    const navBefore = await recipientNavMessages.textContent();

    await openChatWithRecipient(senderPage);
    const firstOwnBubble = await sendMessage(senderPage, liveMessage);

    // No reload: mailbox preview/order and unread state must move from the Postgres change event.
    await expect(recipientPage.getByText(liveMessage, { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(recipientPage.getByTestId('luxy-mailbox-unread-count')).toBeVisible({ timeout: 20_000 });
    await expect.poll(async () => recipientNavMessages.textContent(), { timeout: 20_000 }).not.toBe(navBefore);

    const liveRow = recipientPage.getByTestId('luxy-mailbox-row').filter({ hasText: liveMessage });
    await expect(liveRow).toHaveCount(1);
    await expect(liveRow.getByLabel(/tin chưa đọc$/)).toBeVisible();
    await liveRow.getByRole('button', { name: `Mở cuộc trò chuyện với ${sender.displayName}`, exact: true }).click();

    // Recipient receives the message without a reload. Opening the chat marks it read; sender must
    // receive the other member's read timestamp over the existing conversation realtime channel.
    await expect(recipientPage.getByText(liveMessage, { exact: true }).last()).toBeVisible({ timeout: 20_000 });
    await expect(firstOwnBubble).toContainText('Đã xem', { timeout: 20_000 });

    // Reconnect gate: recipient deliberately misses a second event while offline. Re-subscribing
    // must invalidate the mailbox read model and recover the missed message without page.reload().
    await recipientPage.goto('/messages');
    await expect(recipientPage.getByTestId('luxy-messages-page')).toBeVisible({ timeout: 20_000 });
    await recipientSession.context.setOffline(true);
    await sendMessage(senderPage, reconnectMessage);
    await recipientSession.context.setOffline(false);

    await expect(recipientPage.getByText(reconnectMessage, { exact: true })).toBeVisible({ timeout: 30_000 });
    const reconnectRow = recipientPage.getByTestId('luxy-mailbox-row').filter({ hasText: reconnectMessage });
    await expect(reconnectRow).toHaveCount(1);
    await expect(reconnectRow.getByLabel(/tin chưa đọc$/)).toBeVisible();

    await testInfo.attach('opt10-sender-chat-read-receipt', {
      body: await senderPage.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
    await testInfo.attach('opt10-recipient-mailbox-reconnect', {
      body: await recipientPage.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  } finally {
    await Promise.all([
      senderSession.context.close(),
      recipientSession.context.close(),
    ]);
  }
});
