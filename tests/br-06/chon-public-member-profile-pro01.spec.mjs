import { expect, test } from '@playwright/test';

const password = process.env.BR06_E2E_PASSWORD || 'Br06-local-only-2026!';
const creator = { username: 'br06_creator', displayName: 'BR06 Creator', tier: 'diamond' };
const premiumMember = { username: 'br06_viewer', displayName: 'BR06 Viewer', tier: 'premium' };

const BADGE_EXPECTATIONS = {
  mobile: {
    premium: { displayWidth: 160, displayHeight: 110, naturalWidth: 179, naturalHeight: 199 },
    diamond: { displayWidth: 160, displayHeight: 110, naturalWidth: 180, naturalHeight: 208 },
  },
  desktop: {
    premium: { displayWidth: 160, displayHeight: 110, naturalWidth: 179, naturalHeight: 199 },
    diamond: { displayWidth: 160, displayHeight: 110, naturalWidth: 180, naturalHeight: 208 },
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
  expect(Math.round(box.width), `${tier} badge width`).toBe(expected.displayWidth);
  expect(Math.round(box.height), `${tier} badge height`).toBe(expected.displayHeight);

  const hero = await page.getByTestId('chon-member-profile-hero-photo').boundingBox();
  expect(hero, 'profile hero should render').not.toBeNull();
  expect(box.x).toBeGreaterThanOrEqual(hero.x);
  expect(box.y).toBeGreaterThanOrEqual(hero.y);
  expect(box.x - hero.x).toBeLessThanOrEqual(14);
  expect(box.y - hero.y).toBeLessThanOrEqual(14);
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

test('UI-PRO01 canonical member profile uses shared Chon.Love shell, ordered facts and mobile horizontal album for Free', async ({ browser }, testInfo) => {
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
    await expect(page.getByTestId('chon-member-profile-message-composer')).toBeVisible();
    await expect(page.getByTestId('luxy-free-upgrade-promo')).toBeVisible();
    await expect(page.getByTestId('chon-profile-mobile-action-dock')).toHaveCount(0);
    await expect(page.getByTestId('chon-profile-free-upgrade-promo')).toHaveCount(0);
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

test('UI-PRO01 Free private photo upgrade routes directly to Membership without private-photo popup', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  try {
    await login(page, 'br06.outsider@example.test');
    await openMember(page, creator);
    await expect(page.getByTestId('luxy-free-upgrade-promo')).toBeVisible();
    const lockedTile = page.getByTestId('chon-private-photo-locked-tile');
    await expect(lockedTile).toBeVisible();
    await expect(page.getByTestId('luxy-upgrade-gate-private_photo')).toHaveCount(0);
    await lockedTile.click();
    await expect(page).toHaveURL(/\/settings\/membership(?:\?|$)/, { timeout: 20_000 });
    expect(page.url()).toContain('source=member_profile_private_photo');
    await expect(page.getByTestId('luxy-upgrade-gate-private_photo')).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test('UI-PRO01 public shared profile uses canonical logo, horizontal gallery and large photo lightbox', async ({ browser }) => {
  const authenticatedContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const authenticatedPage = await authenticatedContext.newPage();
  let publicPath;
  try {
    await login(authenticatedPage, 'br06.outsider@example.test');
    await openMember(authenticatedPage, creator);
    publicPath = new URL(authenticatedPage.url()).pathname;
  } finally {
    await authenticatedContext.close();
  }

  const guestContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const guestPage = await guestContext.newPage();
  try {
    await guestPage.goto(publicPath);
    await expect(guestPage.getByTestId('public-member-profile-page')).toBeVisible({ timeout: 20_000 });
    const logoButton = guestPage.getByTestId('public-member-profile-logo');
    await expect(logoButton).toBeVisible();
    await expect(logoButton.getByTestId('chon-love-wordmark')).toBeVisible();
    const gallery = guestPage.getByTestId('public-member-profile-gallery');
    await expect(gallery).toBeVisible();
    const firstPhoto = guestPage.getByTestId('public-member-profile-photo-tile').first();
    await expect(firstPhoto).toBeVisible();
    await firstPhoto.click();
    await expect(guestPage.getByTestId('public-member-profile-photo-lightbox')).toBeVisible();
    await expect(guestPage.getByTestId('public-member-profile-photo-lightbox-image')).toBeVisible();
    await guestPage.getByRole('button', { name: 'Đóng', exact: true }).click();
    await expect(guestPage.getByTestId('public-member-profile-photo-lightbox')).toHaveCount(0);
    await expectNoHorizontalOverflow(guestPage);
  } finally {
    await guestContext.close();
  }
});

test('UI-PRO01 badge source and rendered size follow the Chon.Love Large Premium/Diamond asset contract', async ({ browser }) => {
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

test('UI-PRO01 Premium viewer sees private media while Diamond Large badge remains a server-controlled status signal', async ({ browser }) => {
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
