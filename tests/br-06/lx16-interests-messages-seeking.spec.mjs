import { expect, test } from '@playwright/test';

const password = process.env.BR06_E2E_PASSWORD || 'Br06-local-only-2026!';
const actors = {
  creator: { email: 'br06.creator@example.test', username: 'br06_creator', displayName: 'BR06 Creator' },
  viewer: { email: 'br06.viewer@example.test', username: 'br06_viewer', displayName: 'BR06 Viewer' },
};

async function createDesktopPage(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  return { context, page: await context.newPage() };
}

async function login(page, actor) {
  await page.goto('/auth?mode=login');
  await expect(page.getByTestId('luxy-auth-screen')).toBeVisible();
  await page.getByPlaceholder('email@example.com').fill(actor.email);
  await page.getByPlaceholder('Nhập mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập bằng email' }).click();
  await expect(page.getByTestId('luxy-search-desktop')).toBeVisible({ timeout: 30_000 });
}

async function expectNoHorizontalOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewport + 1);
}

test('LX-16 clones Seeking Interests and Messages hierarchy on LX-15 messaging', async ({ browser }, testInfo) => {
  const viewerSession = await createDesktopPage(browser);
  const creatorSession = await createDesktopPage(browser);
  const viewerPage = viewerSession.page;
  const creatorPage = creatorSession.page;
  const message = `LX16 Seeking inbox ${Date.now()}`;

  try {
    await Promise.all([login(viewerPage, actors.viewer), login(creatorPage, actors.creator)]);

    await viewerPage.goto(`/profile/${actors.creator.username}`);
    await expect(viewerPage).toHaveURL(/\/thanh-vien\/id-[0-9a-f]{6}$/i, { timeout: 20_000 });
    await expect(viewerPage.getByTestId('chon-member-profile-page')).toBeVisible();
    await viewerPage.getByRole('button', { name: 'Nhắn tin', exact: true }).click();
    const chatInput = viewerPage.getByRole('textbox', { name: 'Nội dung tin nhắn', exact: true });
    await expect(chatInput).toBeVisible();
    await chatInput.fill(message);
    await viewerPage.getByRole('button', { name: 'Gửi', exact: true }).click();
    await expect(viewerPage.getByText(message, { exact: true }).last()).toBeVisible();

    await creatorPage.goto('/favorites');
    await expect(creatorPage.getByTestId('luxy-interests-page')).toBeVisible();
    await expect(creatorPage.getByTestId('luxy-interests-tab-favorites')).toHaveAttribute('aria-selected', 'true');
    await expect(creatorPage.getByTestId('luxy-interests-tab-favorites')).toBeVisible();
    await expect(creatorPage.getByTestId('luxy-interests-tab-favorited_me')).toBeVisible();
    const viewedMeTab = creatorPage.getByTestId('luxy-interests-tab-viewed_me');
    await expect(viewedMeTab).toBeVisible();
    await viewedMeTab.click();
    await expect(viewedMeTab).toHaveAttribute('aria-selected', 'true');
    await expect(creatorPage.getByTestId('luxy-interests-sort')).toBeVisible();
    await expect(creatorPage.getByText(actors.viewer.displayName, { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(creatorPage.getByText(/Lượt xem hồ sơ chỉ hiển thị trong 180 ngày gần nhất/)).toBeVisible();

    await testInfo.attach('lx16-desktop-interests-seeking', {
      body: await creatorPage.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });

    await creatorPage.getByRole('button', { name: 'Tin nhắn', exact: true }).click();
    await expect(creatorPage.getByTestId('luxy-messages-page')).toBeVisible({ timeout: 20_000 });
    await expect(creatorPage.getByRole('tab', { name: 'Tin nhắn đến', exact: true })).toBeVisible();
    await expect(creatorPage.getByRole('tab', { name: 'Đã lọc', exact: true })).toBeVisible();
    await expect(creatorPage.getByRole('tab', { name: 'Đã gửi', exact: true })).toBeVisible();
    await expect(creatorPage.getByRole('tab', { name: 'Lưu trữ', exact: true })).toBeVisible();
    await expect(creatorPage.getByTestId('luxy-mailbox-unread-only')).toBeVisible();
    await expect(creatorPage.getByTestId('luxy-mailbox-sort')).toBeVisible();
    await expect(creatorPage.getByTestId('luxy-mailbox-diamond-promo')).toBeVisible();
    await expect(creatorPage.getByText(actors.viewer.displayName, { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(creatorPage.getByText(message, { exact: true })).toBeVisible();

    await testInfo.attach('lx16-desktop-messages-seeking', {
      body: await creatorPage.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });

    await creatorPage.getByRole('button', { name: `Lưu trữ cuộc trò chuyện với ${actors.viewer.displayName}` }).click();
    await expect(creatorPage.getByText(message, { exact: true })).toHaveCount(0, { timeout: 20_000 });
    await creatorPage.getByRole('tab', { name: 'Lưu trữ', exact: true }).click();
    await expect(creatorPage.getByText(message, { exact: true })).toBeVisible({ timeout: 20_000 });
    await creatorPage.getByRole('button', { name: `Khôi phục cuộc trò chuyện với ${actors.viewer.displayName}` }).click();

    await creatorPage.setViewportSize({ width: 390, height: 844 });
    await creatorPage.goto('/favorites');
    await expect(creatorPage.getByTestId('luxy-interests-page')).toBeVisible();
    await expectNoHorizontalOverflow(creatorPage);
    await creatorPage.getByRole('button', { name: 'Tin nhắn', exact: true }).click();
    await expect(creatorPage.getByTestId('luxy-messages-page')).toBeVisible();
    await expectNoHorizontalOverflow(creatorPage);

    await testInfo.attach('lx16-mobile-messages-seeking', {
      body: await creatorPage.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  } finally {
    await Promise.all([viewerSession.context.close(), creatorSession.context.close()]);
  }
});
