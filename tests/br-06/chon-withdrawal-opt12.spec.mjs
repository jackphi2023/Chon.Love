import { expect, test } from '@playwright/test';

const password = process.env.BR06_E2E_PASSWORD || 'Br06-local-only-2026!';
const actor = { email: 'br06.viewer@example.test' };

async function login(page) {
  await page.goto('/auth?mode=login');
  await expect(page.getByTestId('luxy-auth-screen')).toBeVisible();
  await page.getByPlaceholder('email@example.com').fill(actor.email);
  await page.getByPlaceholder('Nhập mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập bằng email' }).click();
  await expect(page.getByText('Kết nối', { exact: true }).first()).toBeVisible({ timeout: 30_000 });
}

async function expectNoHorizontalOverflow(page) {
  const widths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
}

test('OPT-12 runs Balance → withdrawal → pending hold → cancel → restored reward balance at 320px', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 760 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  try {
    await login(page);
    await page.goto('/balance');
    await expect(page.getByTestId('chon-balance-screen')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('balance-withdrawal-entry')).toBeVisible();
    await page.getByTestId('balance-withdrawal-entry').click();

    await expect(page).toHaveURL(/\/withdrawal$/);
    await expect(page.getByTestId('withdrawal-page')).toBeVisible({ timeout: 30_000 });
    const panel = page.getByTestId('withdrawal-panel');
    await expect(panel).toBeVisible();

    // Make retries self-healing if a previous attempt stopped after creating the pending request.
    const staleCancel = panel.getByRole('button', { name: 'Hủy', exact: true });
    if (await staleCancel.count()) {
      await staleCancel.first().click();
      await expect(panel.getByTestId('withdrawal-available-balance')).toHaveText('14 ❤️', { timeout: 20_000 });
    }

    await expect(panel.getByTestId('withdrawal-available-balance')).toHaveText('14 ❤️');
    await expect(panel.getByText('Đã xác minh', { exact: true })).toHaveCount(2);
    await expect(panel.getByText('Sẵn sàng', { exact: true })).toBeVisible();
    await expect(panel.getByRole('radio', { name: 'VCB, tài khoản kết thúc 1234' })).toBeChecked();
    await expect(panel).toContainText('Tối thiểu 10 ❤️');

    await panel.getByTestId('withdrawal-amount-input').fill('10');
    const submit = panel.getByTestId('withdrawal-submit');
    await expect(submit).toBeEnabled();
    await submit.click();

    await expect(panel.getByText(/Yêu cầu rút 500\.000 VNĐ đã được gửi/)).toBeVisible({ timeout: 20_000 });
    await expect(panel.getByTestId('withdrawal-available-balance')).toHaveText('4 ❤️', { timeout: 20_000 });
    const history = panel.getByTestId('withdrawal-history');
    await expect(history).toContainText('500.000 VNĐ');
    await expect(history).toContainText('10 ❤️');
    await expect(history.getByText('Chờ xử lý', { exact: true })).toBeVisible();

    const cancel = history.getByRole('button', { name: 'Hủy', exact: true });
    await expect(cancel).toHaveCount(1);
    await cancel.click();

    await expect(panel.getByText('Yêu cầu rút tiền đã được hủy. Số dư khả dụng đã được hoàn lại.', { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(panel.getByTestId('withdrawal-available-balance')).toHaveText('14 ❤️', { timeout: 20_000 });
    await expect(history.getByText('Đã hủy', { exact: true }).first()).toBeVisible();
    await expect(history.getByRole('button', { name: 'Hủy', exact: true })).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  } finally {
    await context.close();
  }
});
