import { expect, test } from '@playwright/test';

const password = process.env.BR06_E2E_PASSWORD || 'Br06-local-only-2026!';
const actors = {
  creator: { email: 'br06.creator@example.test', name: 'BR06 Creator', username: 'br06_creator' },
  viewer: { email: 'br06.viewer@example.test', name: 'BR06 Viewer', username: 'br06_viewer' },
};

async function createSession(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
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

async function openInterests(page) {
  await page.getByRole('button', { name: 'Yêu thích', exact: true }).click();
  await expect(page.getByTestId('luxy-interests-page')).toBeVisible({ timeout: 20_000 });
}

async function normalizeNotFavorited(page, actor) {
  const removeFavorite = page.getByRole('button', { name: new RegExp(`^Bỏ yêu thích ${actor.name}`) });
  if (await removeFavorite.count()) {
    await removeFavorite.first().click();
    await expect(page.getByRole('button', { name: `Yêu thích ${actor.name}`, exact: true })).toBeVisible();
  }
}

test('UI-FAV01 keeps Favorites newest-first with simplified tabs and branded actions', async ({ browser }, testInfo) => {
  const viewerSession = await createSession(browser);
  const creatorSession = await createSession(browser);
  const viewerPage = viewerSession.page;
  const creatorPage = creatorSession.page;

  try {
    await Promise.all([login(viewerPage, actors.viewer), login(creatorPage, actors.creator)]);

    await normalizeNotFavorited(viewerPage, actors.creator);

    const favoriteCreator = viewerPage.getByRole('button', { name: `Yêu thích ${actors.creator.name}`, exact: true });
    await expect(favoriteCreator).toBeVisible();
    await favoriteCreator.click();
    await expect(viewerPage.getByRole('button', { name: new RegExp(`^Bỏ yêu thích ${actors.creator.name}`) })).toBeVisible();

    await viewerPage.reload();
    await expect(viewerPage.getByTestId('luxy-search-mobile')).toBeVisible({ timeout: 20_000 });
    await expect(viewerPage.getByRole('button', { name: new RegExp(`^Bỏ yêu thích ${actors.creator.name}`) })).toBeVisible();
    await openInterests(viewerPage);

    const tabs = viewerPage.getByTestId('luxy-interests-tabs').getByRole('tab');
    await expect(tabs).toHaveCount(3);
    expect(await tabs.allTextContents()).toEqual(['Yêu thích', 'Yêu thích tôi', 'Đã xem tôi']);

    const favoritesTab = viewerPage.getByTestId('luxy-interests-tab-favorites');
    await expect(favoritesTab).toHaveAttribute('aria-selected', 'true');
    await expect(viewerPage.getByTestId('luxy-interests-sort')).toHaveCount(0);
    await expect(viewerPage.getByText('Tương hợp', { exact: true })).toHaveCount(0);

    const creatorRow = viewerPage.getByTestId('luxy-interests-row').filter({ hasText: actors.creator.name }).first();
    await expect(creatorRow).toBeVisible();
    await expect(creatorRow.getByTestId('chon-seeking-member-photo')).toBeVisible();
    await expect(creatorRow.getByTestId('chon-photo-count')).toBeVisible();
    const creatorBadge = creatorRow.getByTestId('chon-membership-badge-diamond');
    await expect(creatorBadge).toBeVisible();
    const creatorBadgeBox = await creatorBadge.boundingBox();
    expect(creatorBadgeBox).not.toBeNull();
    expect(Math.abs(creatorBadgeBox.height - 12)).toBeLessThanOrEqual(1);
    expect(creatorBadgeBox.width).toBeLessThan(creatorBadgeBox.height);

    const messageButton = creatorRow.getByRole('button', { name: `Nhắn tin cho ${actors.creator.name}` });
    await expect(messageButton).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(messageButton).toHaveCSS('border-color', 'rgb(255, 187, 0)');

    const savedButton = creatorRow.getByRole('button', { name: new RegExp(`^Bỏ yêu thích ${actors.creator.name}`) });
    await expect(savedButton).toHaveCSS('border-color', 'rgb(255, 187, 0)');
    await expect(savedButton.getByText('♥', { exact: true })).toHaveCSS('color', 'rgb(255, 187, 0)');

    await openInterests(creatorPage);
    const creatorFavoritedMeTab = creatorPage.getByTestId('luxy-interests-tab-favorited_me');
    await expect(creatorFavoritedMeTab).toBeVisible();
    await creatorFavoritedMeTab.click();
    await expect(creatorPage.getByText(actors.viewer.name, { exact: true })).toBeVisible({ timeout: 20_000 });

    await creatorPage.goto(`/profile/${actors.viewer.username}`);
    await expect(creatorPage.getByTestId('chon-member-profile-page')).toBeVisible({ timeout: 20_000 });
    await expect(creatorPage.getByRole('heading', { name: new RegExp(`^${actors.viewer.name},`) })).toBeVisible({ timeout: 20_000 });
    await creatorPage.waitForTimeout(500);

    await viewerPage.getByTestId('luxy-interests-tab-viewed_me').click();
    await expect(viewerPage.getByText(actors.creator.name, { exact: true })).toBeVisible({ timeout: 20_000 });

    await viewerPage.getByTestId('luxy-interests-tab-favorites').click();
    const removeFavorite = viewerPage.getByRole('button', { name: new RegExp(`^Bỏ yêu thích ${actors.creator.name}`) });
    await expect(removeFavorite).toBeVisible();
    await removeFavorite.click();
    await expect(viewerPage.getByText(actors.creator.name, { exact: true })).toHaveCount(0, { timeout: 20_000 });

    await creatorPage.goto('/favorites');
    await expect(creatorPage.getByTestId('luxy-interests-page')).toBeVisible();
    await creatorPage.getByTestId('luxy-interests-tab-favorited_me').click();
    await expect(creatorPage.getByText(actors.viewer.name, { exact: true })).toHaveCount(0, { timeout: 20_000 });

    await testInfo.attach('ui-fav01-viewer-favorites', {
      body: await viewerPage.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  } finally {
    await Promise.all([viewerSession.context.close(), creatorSession.context.close()]);
  }
});
