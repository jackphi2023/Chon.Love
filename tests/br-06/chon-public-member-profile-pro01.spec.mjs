import { expect, test } from '@playwright/test';

const password = process.env.BR06_E2E_PASSWORD || 'Br06-local-only-2026!';
const creator = { username: 'br06_creator', displayName: 'BR06 Creator', tier: 'diamond' };
const premiumMember = { username: 'br06_viewer', displayName: 'BR06 Viewer', tier: 'premium' };

const BADGE_EXPECTATIONS = {
  mobile: {
    premium: { displayHeight: 16, naturalWidth: 29, naturalHeight: 40 },
    diamond: { displayHeight: 16, naturalWidth: 31, naturalHeight: 41 },
  },
  desktop: {
    premium: { displayHeight: 26, naturalWidth: 33, naturalHeight: 46 },
    diamond: { displayHeight: 26, naturalWidth: 38, naturalHeight: 50 },
  },
};

async function login(page, email) {
  await page.goto('/auth?mode=login');
  await expect(page.getByTestId('luxy-auth-screen')).toBeVisible();
  await page.getByPlaceholder('email@example.com').fill(email);
  await page.getByPlaceholder('Nhập mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập bằng email' }).click();
  const expectedSearch = (page.viewportSize()?.width ?? 390) >= 1024 ? 'luxy-search-desktop' : 'luxy-search-mobile';
  await expect(page.getByTestId(expectedSearch)).toBeVisible({ timeout: 30_000 });
}

async function openMember(page, member) {
  await page.goto(`/profile/${member.username}`);
  await expect(page).toHaveURL(/\/thanh-vien\/id-[a-z0-9-]+/i, { timeout: 20_000 });
  await expect(page.getByTestId('chon-member-profile-page')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('heading', { name: new RegExp(`^${member.displayName},`) })).toBeVisible();
}

async function expectMembershipArtwork(page, tier, viewport) {
  const expected = BADGE_EXPECTATIONS[viewport][tier];
  const badge = page.getByTestId(`chon-membership-badge-${tier}`).first();
  await expect(badge).toBeVisible();
  const image = badge.getByTestId(`chon-membership-badge-image-${tier}`);
  await expect(image).toHaveCount(1);
  const naturalSize = await image.evaluate(async (node) => {
    const renderedImage = node instanceof HTMLImageElement ? node : node.querySelector('img');
    if (!(renderedImage instanceof HTMLImageElement)) throw new Error('Membership badge image element is missing.');
    if (typeof renderedImage.decode === 'function') await renderedImage.decode();
    return { complete: renderedImage.complete, width: renderedImage.naturalWidth, height: renderedImage.naturalHeight };
  });
  expect(naturalSize.complete).toBe(true);
  expect(naturalSize.width).toBe(expected.naturalWidth);
  expect(naturalSize.height).toBe(expected.naturalHeight);

  const box = await badge.boundingBox();
  expect(box, `${tier} badge should render`).not.toBeNull();
  expect(Math.round(box.height), `${tier} badge height`).toBe(expected.displayHeight);
  expect(Math.round(box.width), `${tier} badge aspect width`).toBe(
    Math.round((expected.displayHeight * expected.naturalWidth) / expected.naturalHeight),
  );

  const hero = await page.getByTestId('chon-member-profile-hero-photo').boundingBox();
  expect(hero, 'profile hero should render').not.toBeNull();
  expect(box.x).toBeGreaterThanOrEqual(hero.x);
  expect(box.y).toBeGreaterThanOrEqual(hero.y);
  expect(box.x + box.width).toBeLessThanOrEqual(hero.x + hero.width + 0.5);
  expect(box.y + box.height).toBeLessThanOrEqual(hero.y + hero.height + 0.5);
}

async function expectNoHorizontalOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewport + 1);
}

test('UI-PRO01 canonical member profile uses Chon.Love owner, ordered facts and mobile horizontal album for Free', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  try {
    await login(page, 'br06.outsider@example.test');
    await openMember(page, creator);

    await expect(page.getByTestId('chon-member-profile-hero-photo')).toBeVisible();
    await expect(page.getByTestId(/chon-favorite-/)).toBeVisible();
    await expectMembershipArtwork(page, creator.tier, 'mobile');
    const verification = page.getByTestId('chon-member-verification-badges');
    await expect(verification).toBeVisible();
    await expect(verification.getByRole('button', { name: /^(Đã|Chưa) xác thực ảnh chụp cá nhân$/ })).toBeVisible();
    await expect(verification.getByRole('button', { name: /^(Đã|Chưa) xác thực CCCD$/ })).toBeVisible();
    await expect(verification.getByRole('button', { name: /^(Đã|Chưa) xác thực LinkedIn$/ })).toBeVisible();

    const info = page.getByTestId('chon-member-profile-info-list');
    const labels = ['Chiều cao', 'Cân nặng', 'Tình trạng mối quan hệ', 'Giới tính', 'Con cái', 'Học vấn', 'Hút thuốc', 'Uống rượu bia', 'Nghề nghiệp'];
    const text = await info.innerText();
    let cursor = -1;
    for (const label of labels) {
      const next = text.indexOf(label);
      expect(next).toBeGreaterThan(cursor);
      cursor = next;
    }

    await expect(page.getByTestId('chon-member-profile-photo-strip')).toBeVisible();
    await expect(page.getByTestId('chon-private-photo-locked-tile')).toBeVisible();
    await expect(page.getByText('Ẩm thực cao cấp', { exact: true })).toBeVisible();
    await expect(page.getByText('Sẵn sàng du lịch', { exact: true })).toBeVisible();
    await expect(page.getByTestId('chon-member-profile-message-composer')).toBeHidden();
    await expect(page.getByTestId('chon-profile-mobile-action-dock')).toBeVisible();
    await expect(page.getByTestId('chon-profile-free-upgrade-promo')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await testInfo.attach('ui-pro01-free-mobile', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });

    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.getByTestId('chon-member-profile-photo-grid')).toBeVisible();
    await expect(page.getByTestId('chon-member-profile-message-composer')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await testInfo.attach('ui-pro01-free-desktop', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  } finally {
    await context.close();
  }
});

test('UI-PRO01 badge source and rendered height follow the Chon.Love Premium/Diamond asset contract', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  try {
    await login(page, 'br06.outsider@example.test');
    await openMember(page, creator);
    await expectMembershipArtwork(page, creator.tier, 'desktop');
    await openMember(page, premiumMember);
    await expectMembershipArtwork(page, premiumMember.tier, 'desktop');
    await expectNoHorizontalOverflow(page);
  } finally {
    await context.close();
  }
});

test('UI-PRO01 Premium viewer sees private media while Diamond member badge remains a server-controlled status signal', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  try {
    await login(page, 'br06.viewer@example.test');
    await openMember(page, creator);
    await expectMembershipArtwork(page, creator.tier, 'desktop');
    const paidTiles = page.getByTestId('chon-private-photo-paid-tile');
    expect(await paidTiles.count()).toBeGreaterThanOrEqual(1);
    await expect(paidTiles.first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('chon-private-photo-locked-tile')).toHaveCount(0);
  } finally {
    await context.close();
  }
});
