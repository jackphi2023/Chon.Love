import { expect, test } from '@playwright/test';

const password = process.env.BR06_E2E_PASSWORD || 'Br06-local-only-2026!';
const actor = { email: 'br06.outsider@example.test' };

const PREMIUM_COPY =
  'Mở toàn bộ trải nghiệm kết nối, quyền riêng tư, đồng thời giúp đối phương nhận biết bạn là thành viên có năng lực tài chính và nghiêm túc trong việc xây dựng mối quan hệ.';
const DIAMOND_COPY =
  'Quyền lợi cao hơn Premium, đồng thời giúp đối phương nhận biết bạn là thành viên có năng lực tài chính cao, có giá trị và sẵn sàng chủ động tặng quà để thể hiện sự quan tâm.';

async function login(page) {
  await page.goto('/auth?mode=login');
  await expect(page.getByTestId('luxy-auth-screen')).toBeVisible();
  await page.getByLabel('Email', { exact: true }).fill(actor.email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập bằng email' }).click();
  await expect(page.getByTestId('luxy-search-mobile')).toBeVisible({ timeout: 30_000 });
}

async function expectBadgeWidth(page, tier, expectedWidth) {
  const badge = page.getByTestId(`chon-membership-badge-${tier}`);
  await expect(badge).toBeVisible();
  const box = await badge.boundingBox();
  expect(box).not.toBeNull();
  expect(Math.round(box.width)).toBe(expectedWidth);
}

test('UI-MEM01 keeps membership focused on Premium and Diamond with Chon.Love presentation', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  try {
    await login(page);
    await page.goto('/settings/membership');
    await expect(page.getByTestId('luxy-upgrade-billing')).toBeVisible({ timeout: 30_000 });

    const heading = page.getByRole('heading', { name: 'Nâng cấp trải nghiệm của bạn' });
    await expect(heading).toBeVisible();
    await expect(heading).toHaveCSS('color', 'rgb(184, 120, 0)');

    await expect(page.getByText(PREMIUM_COPY, { exact: true })).toBeVisible();
    await expect(page.getByText(DIAMOND_COPY, { exact: true })).toBeVisible();
    await expect(page.getByText('Một lần', { exact: true })).toHaveCount(0);
    await expect(page.getByText('ULTIMATE ACCESS', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Quyền riêng tư của gói hiện tại', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Ẩn trạng thái online', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Ẩn khỏi danh sách thành viên', { exact: true })).toHaveCount(0);

    await expectBadgeWidth(page, 'premium', 132);
    await expectBadgeWidth(page, 'diamond', 132);

    await page.setViewportSize({ width: 1024, height: 900 });
    await expect(page.getByTestId('chon-desktop-navigation')).toHaveCount(1);
    await expect(page.getByTestId('chon-authenticated-footer')).toHaveCount(1);
    await expectBadgeWidth(page, 'premium', 160);
    await expectBadgeWidth(page, 'diamond', 160);
  } finally {
    await context.close();
  }
});
