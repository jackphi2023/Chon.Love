import { expect, test } from '@playwright/test';

const password = process.env.BR06_E2E_PASSWORD || 'Br06-local-only-2026!';
const creator = { username: 'br06_creator', displayName: 'BR06 Creator', tier: 'diamond' };
const premiumMember = { username: 'br06_viewer', displayName: 'BR06 Viewer', tier: 'premium' };
const outsider = { email: 'br06.outsider@example.test' };

async function login(page, expectedSearchTestId) {
  await page.goto('/auth?mode=login');
  await expect(page.getByTestId('luxy-auth-screen')).toBeVisible();
  await page.getByPlaceholder('email@example.com').fill(outsider.email);
  await page.getByPlaceholder('Nhập mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập bằng email' }).click();
  await expect(page.getByTestId(expectedSearchTestId)).toBeVisible({ timeout: 30_000 });
}

async function openMemberProfile(page, member) {
  await page.goto(`/profile/${member.username}`);
  await expect(page.getByTestId('luxy-member-profile-page')).toBeVisible();
  await expect(page.getByRole('heading', { name: new RegExp(`^${member.displayName},`) })).toBeVisible();
}

async function expectImageSize(locator, expectedSize, label) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, `${label} should have a rendered box`).not.toBeNull();
  expect(Math.round(box.width), `${label} width`).toBe(expectedSize);
  expect(Math.round(box.height), `${label} height`).toBe(expectedSize);
}

async function expectNavigationIconSize(page, expectedSize) {
  for (const label of ['Kết nối', 'Yêu thích', 'Tin nhắn']) {
    const button = page.getByRole('button', { name: label, exact: true });
    await expect(button).toHaveCount(1);
    await expectImageSize(button.locator('img').first(), expectedSize, `${label} navigation icon`);
  }
}

async function expectVerificationIconHeight(page, expectedHeight) {
  const badges = page.getByTestId('luxy-member-verification-badges');
  await expect(badges).toBeVisible();
  for (const key of ['selfie', 'identity', 'linkedin']) {
    const icon = badges.locator(`[data-testid^="luxy-verification-icon-${key}-"]`);
    await expect(icon).toHaveCount(1);
    const box = await icon.boundingBox();
    expect(box).not.toBeNull();
    expect(Math.round(box.height), `${key} verification icon height`).toBe(expectedHeight);
  }
}

async function expectProfileFactIconSize(page, expectedSize) {
  for (const [testId, label] of [
    ['luxy-profile-fact-recent', 'recent'],
    ['luxy-profile-fact-location', 'location'],
    ['luxy-profile-fact-member-since', 'profile'],
  ]) {
    await expectImageSize(page.getByTestId(testId).locator('img').first(), expectedSize, `${label} profile icon`);
  }
}

async function expectCleanProfilePresentation(page) {
  await expect(page.getByText('Kết nối Beta', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Gửi lời mời kết bạn', exact: true })).toHaveCount(0);
  const relationship = page.getByTestId('luxy-profile-fact-relationship');
  await expect(relationship).toBeVisible();
  await expect(relationship.getByText('Tình trạng', { exact: true })).toBeVisible();
  const relationshipText = await relationship.innerText();
  expect(relationshipText).not.toMatch(/[↕▣♥]/u);
}

async function expectCanonicalMembershipArtwork(page, tier, expectedWidth) {
  const badge = page.locator(`[data-testid="luxy-membership-badge-${tier}"]:visible`);
  await expect(badge).toHaveCount(1);
  await expect(badge.locator('svg')).toHaveCount(0);
  const image = badge.locator('img');
  await expect(image).toHaveCount(1);
  const naturalSize = await image.evaluate(async (node) => {
    await node.decode();
    return {
      complete: node.complete,
      width: node.naturalWidth,
      height: node.naturalHeight,
    };
  });
  expect(naturalSize.complete, `${tier} artwork should finish decoding`).toBe(true);
  expect(naturalSize.width, `${tier} artwork natural width`).toBe(768);
  expect(naturalSize.height, `${tier} artwork natural height`).toBe(528);

  const box = await badge.boundingBox();
  expect(box, `${tier} badge should render`).not.toBeNull();
  expect(Math.round(box.width), `${tier} badge width`).toBe(expectedWidth);
  expect(Math.round(box.height), `${tier} badge height`).toBe(Math.round((expectedWidth * 11) / 16));

  const hero = await page.getByTestId('luxy-member-profile-hero-photo').boundingBox();
  expect(hero, 'hero photo should render').not.toBeNull();
  expect(box.x).toBeGreaterThanOrEqual(hero.x);
  expect(box.y).toBeGreaterThanOrEqual(hero.y);
  expect(box.x + box.width).toBeLessThanOrEqual(hero.x + hero.width + 0.5);
  expect(box.y + box.height).toBeLessThanOrEqual(hero.y + hero.height + 0.5);
}

test('desktop locks canonical profile icons and both complete membership badges', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  try {
    await login(page, 'luxy-search-desktop');
    await expectNavigationIconSize(page, 26);
    await openMemberProfile(page, creator);
    await expectCanonicalMembershipArtwork(page, creator.tier, 160);
    await expectVerificationIconHeight(page, 26);
    await expectProfileFactIconSize(page, 26);
    await expectCleanProfilePresentation(page);
    await openMemberProfile(page, premiumMember);
    await expectCanonicalMembershipArtwork(page, premiumMember.tier, 160);
  } finally {
    await context.close();
  }
});

test('mobile locks canonical profile icons and both complete membership badges', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  try {
    await login(page, 'luxy-search-mobile');
    await expectNavigationIconSize(page, 18);
    await openMemberProfile(page, creator);
    await expectCanonicalMembershipArtwork(page, creator.tier, 132);
    await expectVerificationIconHeight(page, 18);
    await expectProfileFactIconSize(page, 18);
    await expectCleanProfilePresentation(page);
    await openMemberProfile(page, premiumMember);
    await expectCanonicalMembershipArtwork(page, premiumMember.tier, 132);
  } finally {
    await context.close();
  }
});
