import { expect, test } from '@playwright/test';

const password = process.env.BR06_E2E_PASSWORD || 'Br06-local-only-2026!';
const actors = {
  creator: { email: 'br06.creator@example.test', username: 'br06_creator', displayName: 'BR06 Creator' },
  viewer: { email: 'br06.viewer@example.test', username: 'br06_viewer', displayName: 'BR06 Viewer' },
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
  await page.getByPlaceholder('email@example.com').fill(actor.email);
  await page.getByPlaceholder('Nhập mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập bằng email' }).click();
  await expect(page.getByTestId('luxy-search-mobile')).toBeVisible({ timeout: 30_000 });
}

async function openCreatorProfile(page) {
  await page.goto(`/profile/${actors.creator.username}`);
  await expect(page.getByTestId('luxy-member-profile-page')).toBeVisible();
  await expect(page.getByRole('heading', { name: new RegExp(`^${actors.creator.displayName},`) })).toBeVisible();
  await expect(page.getByText(/Activity|Hoạt động & Album ảnh/, { exact: false })).toHaveCount(0);
}

async function expectNoHorizontalOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewport + 1);
}

test('WEB-R01 mobile multi-account validates no-Activity V1 and LX-15 direct messaging', async ({ browser }, testInfo) => {
  const creatorSession = await createMobilePage(browser);
  const viewerSession = await createMobilePage(browser);
  const outsiderSession = await createMobilePage(browser);
  const creatorPage = creatorSession.page;
  const viewerPage = viewerSession.page;
  const outsiderPage = outsiderSession.page;
  const message = `WEB-R01 direct message ${Date.now()}`;

  try {
    await Promise.all([
      login(creatorPage, actors.creator),
      login(viewerPage, actors.viewer),
      login(outsiderPage, actors.outsider),
    ]);

    // Old Activity URLs are intentionally retained only as safe redirects.
    await viewerPage.goto('/activity');
    await expect(viewerPage.getByTestId('luxy-search-mobile')).toBeVisible();
    await viewerPage.goto(`/activity/${actors.creator.username}`);
    await expect(viewerPage.getByTestId('luxy-search-mobile')).toBeVisible();
    await viewerPage.goto('/activity/create');
    await expect(viewerPage.getByTestId('luxy-search-mobile')).toBeVisible();

    // Premium fixture uses the fixed mobile CTA for LX-15 direct messaging without friendship.
    await openCreatorProfile(viewerPage);
    await viewerPage.getByRole('button', { name: `Gửi tin nhắn cho ${actors.creator.displayName}`, exact: true }).click();
    const chatInput = viewerPage.getByRole('textbox', { name: 'Nội dung tin nhắn', exact: true });
    await expect(chatInput).toBeVisible();
    await chatInput.fill(message);
    await viewerPage.getByRole('button', { name: 'Gửi', exact: true }).click();
    await expect(viewerPage.getByText(message, { exact: true }).last()).toBeVisible();

    // Recipient can read the incoming direct message even when their own send entitlement differs.
    await creatorPage.getByRole('button', { name: 'Tin nhắn', exact: true }).click();
    await expect(creatorPage.getByTestId('luxy-messages-page')).toBeVisible({ timeout: 20_000 });
    await expect(creatorPage.getByRole('tab', { name: 'Tin nhắn đến', exact: true })).toBeVisible();
    await expect(creatorPage.getByText(actors.viewer.displayName, { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(creatorPage.getByText(message, { exact: true })).toBeVisible();

    // Free fixture can browse/favorite but messaging and Private Photos remain paid entitlements.
    await openCreatorProfile(outsiderPage);
    const favorite = outsiderPage.getByRole('button', { name: new RegExp(`^(Yêu thích|Bỏ yêu thích) ${actors.creator.displayName}`) });
    await expect(favorite).toBeVisible();
    await favorite.click();
    await expect(outsiderPage.getByTestId('luxy-upgrade-gate-favorite')).toHaveCount(0);

    await expect(outsiderPage.getByTestId('luxy-profile-free-upgrade-promo')).toBeVisible();
    await outsiderPage.getByRole('button', { name: `Gửi tin nhắn cho ${actors.creator.displayName}`, exact: true }).click();
    await expect(outsiderPage).toHaveURL(/\/settings\/membership/);
    await expect(outsiderPage.getByTestId('luxy-upgrade-billing')).toBeVisible();

    await outsiderPage.goto(`/profile/${actors.creator.username}`);
    const privateEntitlement = outsiderPage.getByTestId('luxy-private-photo-entitlement-button');
    await expect(privateEntitlement).toBeVisible();
    await privateEntitlement.click();
    await expect(outsiderPage.getByTestId('luxy-upgrade-gate-private_photo')).toBeVisible();
    await expect(outsiderPage.getByText(/Premium hoặc Diamond tự động được xem đầy đủ ảnh riêng tư/)).toBeVisible();

    await Promise.all([
      expectNoHorizontalOverflow(creatorPage),
      expectNoHorizontalOverflow(viewerPage),
      expectNoHorizontalOverflow(outsiderPage),
    ]);

    await testInfo.attach('web-r01-mobile-direct-message', {
      body: await creatorPage.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  } finally {
    await Promise.all([
      creatorSession.context.close(),
      viewerSession.context.close(),
      outsiderSession.context.close(),
    ]);
  }
});