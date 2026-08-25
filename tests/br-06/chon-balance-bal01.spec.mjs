import { expect, test } from '@playwright/test';

const password = process.env.BR06_E2E_PASSWORD || 'Br06-local-only-2026!';
const actor = { email: 'br06.viewer@example.test' };
const PACKS = [10, 50, 100, 200, 500, 1000];

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

test('UI-BAL01 exposes the final six server-priced packs in a 2-column mobile grid', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  try {
    await login(page);
    await page.goto('/balance');
    await expect(page.getByTestId('chon-balance-screen')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'Số dư' })).toBeVisible();
    await expect(page.getByTestId('balance-single-line')).toContainText('Số dư khả dụng:');
    await expect(page.getByTestId('balance-catalog-blocker')).toHaveCount(0);

    for (const hearts of PACKS) {
      await expect(page.getByTestId(`balance-pack-${hearts}`)).toBeVisible();
    }
    await expect(page.getByTestId('balance-pack-5')).toHaveCount(0);
    await expect(page.getByTestId('balance-pack-20')).toHaveCount(0);

    const first = await page.getByTestId('balance-pack-10').boundingBox();
    const second = await page.getByTestId('balance-pack-50').boundingBox();
    const third = await page.getByTestId('balance-pack-100').boundingBox();
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(third).not.toBeNull();
    expect(Math.abs(first.y - second.y)).toBeLessThan(3);
    expect(third.y).toBeGreaterThan(first.y + 40);
    expect(second.x).toBeGreaterThan(first.x + 20);

    const selected = page.getByTestId('balance-pack-10');
    await expect(selected).toHaveAttribute('aria-checked', 'true');
    await expect(selected).toHaveCSS('background-color', 'rgb(184, 120, 0)');
    await expect(selected).toHaveCSS('border-color', 'rgb(217, 45, 42)');

    const cta = page.getByTestId('balance-checkout-cta');
    await expect(cta).toBeEnabled();
    await expect(cta).toHaveCSS('background-color', 'rgb(217, 45, 42)');
    await expectNoHorizontalOverflow(page);
  } finally {
    await context.close();
  }
});

test('UI-BAL01 uses server product id and amount in the shared payment popup', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  try {
    await login(page);
    await page.goto('/balance');
    await expect(page.getByTestId('chon-balance-screen')).toBeVisible({ timeout: 30_000 });

    await page.getByTestId('balance-pack-10').click();
    await page.getByTestId('balance-checkout-cta').click();
    const modal = page.getByTestId('balance-payment-modal');
    await expect(modal).toBeVisible({ timeout: 30_000 });
    await expect(modal.getByText('Mã sản phẩm', { exact: true })).toBeVisible();
    await expect(modal.getByText('Số tiền', { exact: true })).toBeVisible();
    await expect(modal.getByText(/^[0-9a-f]{8}-[0-9a-f-]{27}$/i)).toBeVisible();
    await expect(modal.getByText('500.000 VNĐ', { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto('/payments/vietqr');
    await expect(page).toHaveURL(/\/balance$/);
    await expect(page.getByTestId('chon-balance-screen')).toBeVisible();
  } finally {
    await context.close();
  }
});
