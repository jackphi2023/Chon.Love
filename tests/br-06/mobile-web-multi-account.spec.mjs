import { expect, test } from '@playwright/test';

const password = process.env.BR06_E2E_PASSWORD || 'Br06-local-only-2026!';
const actors = {
  creator: { email: 'br06.creator@example.test', username: 'br06_creator', displayName: 'BR06 Creator' },
  viewer: { email: 'br06.viewer@example.test', username: 'br06_viewer', displayName: 'BR06 Viewer' },
  fan: { email: 'br06.fan@example.test', username: 'br06_fan', displayName: 'BR06 Fan' },
  outsider: { email: 'br06.outsider@example.test', username: 'br06_outsider', displayName: 'BR06 Outsider' },
};

async function createMobilePage(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  return { context, page: await context.newPage() };
}

async function login(page, actor) {
  await page.goto('/auth?mode=login');
  await expect(page.getByTestId('luxy-auth-screen')).toBeVisible();
  await expect(page.getByText('Đăng nhập', { exact: true }).first()).toBeVisible();
  await page.getByPlaceholder('email@example.com').fill(actor.email);
  await page.getByPlaceholder('Nhập mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập bằng email' }).click();
  await expect(page.getByTestId('luxy-search-mobile')).toBeVisible({ timeout: 30_000 });
}

async function navigateToCreatorProfile(page) {
  await page.goto(`/profile/${actors.creator.username}`);
}

async function openCreatorProfile(page) {
  await navigateToCreatorProfile(page);
  await expect(page.getByTestId('luxy-member-profile-page')).toBeVisible();
  await expect(page.getByRole('heading', { name: new RegExp(`^${actors.creator.displayName},`) })).toBeVisible();
}

async function setCreatorVisibility(page, label) {
  await page.goto('/activity');
  await expect(page.getByText('Ai được xem toàn bộ Hoạt động?', { exact: true })).toBeVisible();
  await page.getByRole('radio', { name: new RegExp(label, 'i') }).click();
  await expect(page.getByRole('alert')).toContainText(`Đã đặt quyền Hoạt động: ${label}`);
}

test('BR-06 mobile web multi-account social and Creator privacy lifecycle', async ({ browser }, testInfo) => {
  const creatorSession = await createMobilePage(browser);
  const viewerSession = await createMobilePage(browser);
  const fanSession = await createMobilePage(browser);
  const outsiderSession = await createMobilePage(browser);

  const creatorPage = creatorSession.page;
  const viewerPage = viewerSession.page;
  const fanPage = fanSession.page;
  const outsiderPage = outsiderSession.page;

  try {
    await Promise.all([
      login(creatorPage, actors.creator),
      login(viewerPage, actors.viewer),
      login(fanPage, actors.fan),
      login(outsiderPage, actors.outsider),
    ]);

    // Retries share the same local DB. Normalize Creator visibility so the first
    // public-profile assertion is deterministic even after a prior failed attempt.
    await setCreatorVisibility(creatorPage, 'Công khai');

    await openCreatorProfile(viewerPage);
    await expect(viewerPage.getByText('BR06 approved Activity image', { exact: true })).toBeVisible();
    await expect(viewerPage.getByText('Album Hoạt động', { exact: true })).toBeVisible();
    await expect(viewerPage.getByRole('img', { name: 'BR06 approved Activity image' })).toBeVisible();

    await viewerPage.getByLabel('Lời chào khi gửi lời mời kết bạn').fill('BR06 browser friendship request');
    await viewerPage.getByRole('button', { name: 'Gửi lời mời kết bạn' }).click();
    await expect(viewerPage.getByRole('alert')).toContainText('Đã gửi lời mời kết bạn.');

    await creatorPage.goto('/friends');
    await creatorPage.getByRole('tab', { name: 'Đã nhận' }).click();
    await expect(creatorPage.getByText(actors.viewer.displayName, { exact: true })).toBeVisible();
    await creatorPage.getByRole('button', { name: 'Chấp nhận' }).click();
    await expect(creatorPage.getByRole('alert')).toContainText('Đã chấp nhận lời mời kết bạn. Chat đã được mở.');

    await setCreatorVisibility(creatorPage, 'Bạn bè');

    await openCreatorProfile(viewerPage);
    await expect(viewerPage.getByText('BR06 approved Activity image', { exact: true })).toBeVisible();
    await expect(viewerPage.getByText('Album Hoạt động', { exact: true })).toBeVisible();

    await openCreatorProfile(outsiderPage);
    await expect(outsiderPage.getByText('Hoạt động dành cho Bạn bè', { exact: true })).toBeVisible();
    await expect(outsiderPage.getByText('BR06 approved Activity image', { exact: true })).toHaveCount(0);
    await expect(outsiderPage.getByText('Album Hoạt động', { exact: true })).toHaveCount(0);

    await setCreatorVisibility(creatorPage, 'Chỉ Fan');

    await openCreatorProfile(viewerPage);
    await expect(viewerPage.getByText('Hoạt động dành cho Fan', { exact: true })).toBeVisible();
    await expect(viewerPage.getByText('BR06 approved Activity image', { exact: true })).toHaveCount(0);

    await openCreatorProfile(fanPage);
    await expect(fanPage.getByText('BR06 approved Activity image', { exact: true })).toBeVisible();
    await expect(fanPage.getByText('Album Hoạt động', { exact: true })).toBeVisible();

    await openCreatorProfile(viewerPage);
    await viewerPage.getByRole('button', { name: 'Nhắn tin', exact: true }).click();
    const chatInput = viewerPage.getByRole('textbox', { name: 'Nội dung tin nhắn', exact: true });
    await expect(chatInput).toBeVisible();
    await chatInput.fill('BR06 browser realtime message');
    await viewerPage.getByRole('button', { name: 'Gửi', exact: true }).click();
    await expect(viewerPage.getByText('BR06 browser realtime message', { exact: true }).last()).toBeVisible();

    await creatorPage.goto('/friends');
    await expect(creatorPage.getByText(actors.viewer.displayName, { exact: true })).toBeVisible();
    await creatorPage.getByText(actors.viewer.displayName, { exact: true }).click();
    await expect(creatorPage.getByText('BR06 browser realtime message', { exact: true }).last()).toBeVisible();

    await creatorPage.getByRole('button', { name: 'Báo cáo' }).last().click();
    await expect(creatorPage.getByText('Báo cáo tin nhắn', { exact: true })).toBeVisible();
    await creatorPage.getByRole('button', { name: 'Gửi báo cáo' }).click();
    await expect(creatorPage.getByRole('alert')).toContainText('Báo cáo tin nhắn đã được gửi');

    creatorPage.once('dialog', async (dialog) => dialog.accept());
    await creatorPage.getByRole('button', { name: 'Chặn', exact: true }).click();
    await expect(creatorPage.getByRole('alert')).toContainText('Đã chặn tài khoản và ngắt khả năng gửi tin.');
    await expect(creatorPage.getByText('Không thể gửi tin nhắn', { exact: true })).toBeVisible();

    await viewerPage.reload();
    await expect(viewerPage.getByText('Không thể gửi tin nhắn', { exact: true })).toBeVisible();

    await navigateToCreatorProfile(viewerPage);
    await expect(viewerPage.getByText('Không tìm thấy hồ sơ', { exact: true })).toBeVisible();

    await creatorPage.goto('/friends');
    await creatorPage.getByRole('tab', { name: 'Đã chặn' }).click();
    await expect(creatorPage.getByText(actors.viewer.displayName, { exact: true })).toBeVisible();
    await creatorPage.getByRole('button', { name: 'Bỏ chặn' }).click();
    await expect(creatorPage.getByRole('alert')).toContainText('Đã bỏ chặn tài khoản. Quan hệ bạn bè cũ không được tự động khôi phục.');

    await openCreatorProfile(viewerPage);
    await expect(viewerPage.getByRole('button', { name: 'Gửi lời mời kết bạn' })).toBeVisible();
    await expect(viewerPage.getByRole('button', { name: 'Nhắn tin', exact: true })).toBeVisible();
    await expect(viewerPage.getByText('Hoạt động dành cho Fan', { exact: true })).toBeVisible();

    await testInfo.attach('br06-final-unblocked-profile', {
      body: await viewerPage.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  } finally {
    await Promise.all([
      creatorSession.context.close(),
      viewerSession.context.close(),
      fanSession.context.close(),
      outsiderSession.context.close(),
    ]);
  }
});