import { expect, test } from '@playwright/test';

const password = process.env.BR06_E2E_PASSWORD || 'Br06-local-only-2026!';
const actor = { email: 'br06.viewer@example.test' };

async function login(page) {
  await page.goto('/auth?mode=login');
  await expect(page.getByTestId('luxy-auth-screen')).toBeVisible();
  await page.getByLabel('Email', { exact: true }).fill(actor.email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập bằng email' }).click();
  await expect(page.getByTestId('luxy-search-mobile')).toBeVisible({ timeout: 30_000 });
}

async function expectUnifiedMailbox(page) {
  await expect(page.getByTestId('luxy-messages-page')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('heading', { name: 'Tin nhắn', exact: true })).toBeVisible();

  for (const folder of ['inbox', 'filtered', 'sent', 'archive']) {
    await expect(page.getByTestId(`luxy-mailbox-folder-${folder}`)).toHaveCount(0);
  }

  await expect(page.getByLabel('Tìm trong Tin nhắn')).toHaveCount(0);
  await expect(page.getByTestId('luxy-mailbox-diamond-promo')).toHaveCount(0);
  await expect(page.getByText(/Luxy\.Love/)).toHaveCount(0);

  await expect(page.getByTestId('luxy-mailbox-unread-only')).toBeVisible();
  await expect(page.getByTestId('luxy-mailbox-sort')).toBeVisible();
}

test('UI-MSG01 keeps one clean mailbox without folders, search or Diamond promo', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  try {
    await login(page);
    await page.goto('/messages');
    await expectUnifiedMailbox(page);

    await testInfo.attach('ui-msg01-mobile-mailbox', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });

    await page.getByTestId('luxy-mailbox-unread-only').click();
    await expect(page.getByTestId('luxy-mailbox-unread-only')).toHaveAttribute('aria-checked', 'true');

    const sort = page.getByTestId('luxy-mailbox-sort');
    await expect(sort).toContainText('Mới nhất');
    await sort.click();
    await expect(sort).toContainText('Cũ nhất');

    await page.setViewportSize({ width: 1280, height: 900 });
    await expectUnifiedMailbox(page);

    await testInfo.attach('ui-msg01-desktop-mailbox', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  } finally {
    await context.close();
  }
});
