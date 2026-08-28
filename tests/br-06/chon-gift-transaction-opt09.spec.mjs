import { expect, test } from '@playwright/test';

const password = process.env.BR06_E2E_PASSWORD || 'Br06-local-only-2026!';
const sender = { email: 'br06.viewer@example.test', displayName: 'BR06 Viewer' };
const recipient = { email: 'br06.creator@example.test', username: 'br06_creator', displayName: 'BR06 Creator' };

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

async function openRecipientProfile(page) {
  await page.goto(`/profile/${recipient.username}`);
  await expect(page).toHaveURL(/\/thanh-vien\/id-[0-9a-f]{6}$/i, { timeout: 20_000 });
  await expect(page.getByTestId('chon-member-profile-page')).toBeVisible({ timeout: 20_000 });
}

test('OPT-09 gift transaction confirms once and refreshes sender/recipient history in realtime', async ({ browser }, testInfo) => {
  const senderSession = await createMobilePage(browser);
  const recipientSession = await createMobilePage(browser);
  const senderPage = senderSession.page;
  const recipientPage = recipientSession.page;

  try {
    await Promise.all([
      login(senderPage, sender),
      login(recipientPage, recipient),
    ]);

    // Subscribe the recipient before sending so this test proves a real server event refreshes
    // the history without a browser reload or a client-side optimistic insertion.
    await recipientPage.goto('/gifts');
    await expect(recipientPage.getByTestId('luxy-gifts-income-page')).toBeVisible({ timeout: 20_000 });
    await expect(recipientPage.getByRole('tab', { name: 'Đã nhận', exact: true })).toHaveAttribute('aria-selected', 'true');

    await openRecipientProfile(senderPage);
    const giftAction = senderPage.getByRole('button', { name: `Tặng quà cho ${recipient.displayName}`, exact: true });
    await expect(giftAction).toBeVisible();
    await giftAction.click();

    const picker = senderPage.getByTestId('chon-gift-picker');
    await expect(picker).toBeVisible();
    await picker.getByRole('button', { name: 'Donut, 1 ❤️', exact: true }).click();
    await picker.getByRole('button', { name: 'Tiếp tục', exact: true }).click();

    await expect(picker.getByTestId('chon-gift-picker-confirm-step')).toBeVisible();
    await expect(picker.getByRole('heading', { name: 'Xác nhận tặng quà', exact: true })).toBeVisible();
    await expect(picker.getByText(`Bạn sẽ gửi 1 ❤️ đến ${recipient.displayName}.`, { exact: true })).toBeVisible();

    await picker.getByRole('button', { name: 'Xác nhận tặng', exact: true }).click();
    const result = picker.getByTestId('chon-gift-picker-result');
    await expect(result).toBeVisible({ timeout: 20_000 });
    await expect(result.getByText(`Đã tặng Donut cho ${recipient.displayName}`, { exact: true })).toBeVisible();
    await expect(result.getByText(/Số dư còn lại 99 ❤️\./)).toBeVisible();

    // Recipient history must change from the database realtime event, without page.reload().
    await expect(recipientPage.getByText('Donut', { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(recipientPage.getByText(new RegExp(`Từ ${sender.displayName}`))).toBeVisible();
    await expect(recipientPage.getByText(/Thu nhập 0,7 ❤️/)).toBeVisible();

    await picker.getByRole('button', { name: 'Xong', exact: true }).click();
    await senderPage.goto('/gifts');
    await expect(senderPage.getByTestId('luxy-gifts-income-page')).toBeVisible({ timeout: 20_000 });
    await senderPage.getByRole('tab', { name: 'Đã gửi', exact: true }).click();
    await expect(senderPage.getByText('Donut', { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(senderPage.getByText(new RegExp(`Đến ${recipient.displayName}`))).toBeVisible();
    await expect(senderPage.getByText('1 ❤️', { exact: true }).last()).toBeVisible();

    await testInfo.attach('opt09-sender-result', {
      body: await senderPage.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
    await testInfo.attach('opt09-recipient-realtime-history', {
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
