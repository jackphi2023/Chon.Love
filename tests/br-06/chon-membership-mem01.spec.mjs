import { expect, test } from '@playwright/test';

const password = process.env.BR06_E2E_PASSWORD || 'Br06-local-only-2026!';
const actor = { email: 'br06.outsider@example.test' };

const PREMIUM_COPY =
  'Mở toàn bộ trải nghiệm kết nối, quyền riêng tư, đồng thời giúp đối phương nhận biết bạn là thành viên có năng lực tài chính và nghiêm túc trong việc xây dựng mối quan hệ.';
const DIAMOND_COPY =
  'Quyền lợi cao hơn Premium, đồng thời giúp đối phương nhận biết bạn là thành viên có năng lực tài chính cao, có giá trị và sẵn sàng chủ động tặng quà để thể hiện sự quan tâm.';

const CERTIFICATE_SOURCE = {
  premium: { naturalWidth: 179, naturalHeight: 199 },
  diamond: { naturalWidth: 180, naturalHeight: 208 },
};

async function login(page) {
  await page.goto('/auth?mode=login');
  await expect(page.getByTestId('luxy-auth-screen')).toBeVisible();
  await page.getByLabel('Email', { exact: true }).fill(actor.email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập bằng email' }).click();
  await expect(page.getByTestId('luxy-search-mobile')).toBeVisible({ timeout: 30_000 });
}

async function getRenderedImageDetails(locator) {
  return locator.evaluate(async (node) => {
    const image = node instanceof HTMLImageElement ? node : node.querySelector('img');
    if (!(image instanceof HTMLImageElement)) throw new Error('Membership badge image element is missing.');
    if (typeof image.decode === 'function') await image.decode();
    return {
      source: image.currentSrc || image.getAttribute('src'),
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
    };
  });
}

async function expectCertificateBadge(page, tier, expectedHeight) {
  const badge = page.getByTestId(`chon-membership-badge-${tier}`);
  await expect(badge).toBeVisible();
  const box = await badge.boundingBox();
  expect(box).not.toBeNull();
  expect(Math.abs(box.height - expectedHeight)).toBeLessThanOrEqual(1);

  const image = badge.getByTestId(`chon-membership-badge-image-${tier}`);
  await expect(image).toBeVisible();
  const details = await getRenderedImageDetails(image);
  expect(details.source).toBeTruthy();
  expect(details.naturalWidth).toBe(CERTIFICATE_SOURCE[tier].naturalWidth);
  expect(details.naturalHeight).toBe(CERTIFICATE_SOURCE[tier].naturalHeight);

  const renderedRatio = box.width / box.height;
  const naturalRatio = details.naturalWidth / details.naturalHeight;
  expect(Math.abs(renderedRatio - naturalRatio), `${tier} certificate must preserve source aspect ratio`).toBeLessThan(0.01);

  const stage = badge.locator('..');
  const stageBox = await stage.boundingBox();
  expect(stageBox).not.toBeNull();
  expect(box.x).toBeGreaterThanOrEqual(stageBox.x - 1);
  expect(box.x + box.width).toBeLessThanOrEqual(stageBox.x + stageBox.width + 1);
  expect(Math.abs((box.x + box.width / 2) - (stageBox.x + stageBox.width / 2))).toBeLessThanOrEqual(1.5);
  expect(box.y).toBeGreaterThanOrEqual(stageBox.y - 1);
  expect(box.y + box.height).toBeLessThanOrEqual(stageBox.y + stageBox.height + 1);

  return details.source;
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
    await expect(page.getByRole('switch')).toHaveCount(0);
    await expect(page.getByText('Ẩn khỏi danh sách thành viên', { exact: true })).toHaveCount(0);
    await expect(page.getByTestId('chon-authenticated-footer')).toHaveCount(0);
    const membershipFooter = page.getByTestId('chon-membership-footer');
    await expect(membershipFooter).toHaveCount(1);
    await membershipFooter.scrollIntoViewIfNeeded();
    await expect(membershipFooter).toBeVisible();

    const premiumMobileSource = await expectCertificateBadge(page, 'premium', 91);
    const diamondMobileSource = await expectCertificateBadge(page, 'diamond', 91);
    expect(premiumMobileSource).not.toBe(diamondMobileSource);

    await page.setViewportSize({ width: 1024, height: 900 });
    await expect(page.getByTestId('chon-desktop-navigation')).toHaveCount(1);
    await expect(page.getByTestId('chon-authenticated-footer')).toHaveCount(0);
    await expect(page.getByTestId('chon-membership-footer')).toHaveCount(1);
    const premiumDesktopSource = await expectCertificateBadge(page, 'premium', 110);
    const diamondDesktopSource = await expectCertificateBadge(page, 'diamond', 110);
    expect(premiumDesktopSource).toBe(premiumMobileSource);
    expect(diamondDesktopSource).toBe(diamondMobileSource);
  } finally {
    await context.close();
  }
});
