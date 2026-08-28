import { expect, test } from '@playwright/test';

const password = process.env.BR06_E2E_PASSWORD || 'Br06-local-only-2026!';
const actor = { email: 'br06.viewer@example.test' };
const PACKS = [10, 50, 100, 200, 500, 1000];
const CHROME_GOLD = 'rgb(255, 205, 70)';

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

async function expectSameRow(page, leftHearts, rightHearts) {
  const left = await page.getByTestId(`balance-pack-${leftHearts}`).boundingBox();
  const right = await page.getByTestId(`balance-pack-${rightHearts}`).boundingBox();
  expect(left).not.toBeNull();
  expect(right).not.toBeNull();
  expect(Math.abs(left.y - right.y)).toBeLessThan(3);
  expect(right.x).toBeGreaterThan(left.x + 20);
  expect(Math.abs(left.width - right.width)).toBeLessThan(3);
  return { left, right };
}

test('OPT-11 keeps all six Balance packs in a 2-column grid at 320px and uses chrome-gold hover/active states', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 760 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  try {
    await login(page);
    await page.goto('/balance');
    await expect(page.getByTestId('chon-balance-screen')).toBeVisible({ timeout: 30_000 });

    const heading = page.getByRole('heading', { name: 'Số dư' });
    await expect(heading).toBeVisible();
    await expect(heading).toHaveCSS('color', CHROME_GOLD);
    await expect(page.getByTestId('balance-single-line')).toContainText('Số dư khả dụng:');
    await expect(page.getByTestId('balance-catalog-blocker')).toHaveCount(0);

    for (const hearts of PACKS) {
      await expect(page.getByTestId(`balance-pack-${hearts}`)).toBeVisible();
    }
    await expect(page.getByTestId('balance-pack-5')).toHaveCount(0);
    await expect(page.getByTestId('balance-pack-20')).toHaveCount(0);

    const row1 = await expectSameRow(page, 10, 50);
    const row2 = await expectSameRow(page, 100, 200);
    const row3 = await expectSameRow(page, 500, 1000);
    expect(row2.left.y).toBeGreaterThan(row1.left.y + 40);
    expect(row3.left.y).toBeGreaterThan(row2.left.y + 40);

    const selected = page.getByTestId('balance-pack-10');
    await expect(selected).toHaveAttribute('aria-checked', 'true');
    await expect(selected).toHaveCSS('background-color', CHROME_GOLD);
    await expect(selected).toHaveCSS('border-color', CHROME_GOLD);

    const hovered = page.getByTestId('balance-pack-50');
    await hovered.hover();
    await expect(hovered).toHaveCSS('background-color', CHROME_GOLD);
    await expect(hovered).toHaveCSS('border-color', CHROME_GOLD);

    await hovered.click();
    await heading.hover();
    await expect(hovered).toHaveAttribute('aria-checked', 'true');
    await expect(hovered).toHaveCSS('background-color', CHROME_GOLD);
    await expect(hovered).toHaveCSS('border-color', CHROME_GOLD);

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

    const pack = page.getByTestId('balance-pack-10');
    const serverPrice = await pack.getByText(/VNĐ$/).innerText();
    expect(serverPrice).toMatch(/^[0-9.]+ VNĐ$/);

    await pack.click();
    await page.getByTestId('balance-checkout-cta').click();
    const modal = page.getByTestId('balance-payment-modal');
    await expect(modal).toBeVisible({ timeout: 30_000 });
    await expect(modal.getByText('Mã sản phẩm', { exact: true })).toBeVisible();
    await expect(modal.getByText('Số tiền', { exact: true })).toBeVisible();
    await expect(modal.getByText(/^[0-9a-f]{8}-[0-9a-f-]{27}$/i)).toBeVisible();
    await expect(modal.getByText(serverPrice, { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto('/payments/vietqr');
    await expect(page).toHaveURL(/\/balance$/);
    await expect(page.getByTestId('chon-balance-screen')).toBeVisible();
  } finally {
    await context.close();
  }
});
