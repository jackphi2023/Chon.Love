import { expect, test } from '@playwright/test';

const password = process.env.BR06_E2E_PASSWORD || 'Br06-local-only-2026!';
const creator = { username: 'br06_creator', displayName: 'BR06 Creator' };
const outsider = { email: 'br06.outsider@example.test' };

async function login(page, expectedSearchTestId) {
  await page.goto('/auth?mode=login');
  await expect(page.getByTestId('luxy-auth-screen')).toBeVisible();
  await page.getByPlaceholder('email@example.com').fill(outsider.email);
  await page.getByPlaceholder('Nhập mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập bằng email' }).click();
  await expect(page.getByTestId(expectedSearchTestId)).toBeVisible({ timeout: 30_000 });
}

async function openCreatorProfile(page) {
  await page.goto(`/profile/${creator.username}`);
  await expect(page.getByTestId('luxy-member-profile-page')).toBeVisible();
  await expect(page.getByRole('heading', { name: new RegExp(`^${creator.displayName},`) })).toBeVisible();
}

async function expectNoHorizontalOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewport + 1);
}

test('LX-13 desktop Member Profile shows paid badge, photo viewer, favorite and upgrade handoff', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  try {
    await login(page, 'luxy-search-desktop');
    await openCreatorProfile(page);

    await expect(page.getByTestId('luxy-membership-badge-diamond').first()).toBeVisible();
    await expect(page.getByText('Về tôi', { exact: true })).toBeVisible();
    await expect(page.getByText('Tôi đang tìm kiếm', { exact: true })).toBeVisible();
    await expect(page.getByText('Ẩm thực cao cấp', { exact: true })).toBeVisible();
    await expect(page.getByTestId('luxy-member-profile-message-composer')).toBeVisible();
    await expect(page.getByTestId('luxy-member-profile-hero-photo')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await testInfo.attach('lx13-desktop-member-profile', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });

    const publicPhoto = page.getByTestId('luxy-member-profile-photo-tile').first();
    await expect(publicPhoto.getByRole('img', { name: `Ảnh của ${creator.displayName}`, exact: true })).toBeVisible();
    await publicPhoto.click();
    const photoModal = page.getByTestId('luxy-profile-photo-modal');
    await expect(photoModal).toBeVisible();
    await expect(photoModal.getByRole('img', { name: `Ảnh của ${creator.displayName}`, exact: true })).toBeVisible();

    const favorite = photoModal.getByRole('button', { name: new RegExp(`^(Yêu thích|Bỏ yêu thích) ${creator.displayName}`) });
    await expect(favorite).toBeVisible();
    const wasFavorited = (await favorite.getAttribute('aria-label'))?.startsWith('Bỏ yêu thích') ?? false;
    await favorite.click();
    await expect(photoModal.getByRole('button', {
      name: new RegExp(`^${wasFavorited ? 'Yêu thích' : 'Bỏ yêu thích'} ${creator.displayName}`),
    })).toBeVisible();

    await photoModal.getByLabel(`Tin nhắn cho ${creator.displayName}`).fill('Xin chào từ ảnh hồ sơ');
    await photoModal.getByRole('button', { name: `Nhắn tin cho ${creator.displayName}` }).click();

    await expect(page.getByTestId('luxy-message-upgrade-gate')).toBeVisible();
    await expect(page.getByText('Bắt đầu nhắn tin ngay!', { exact: true })).toBeVisible();
    await expect(page.getByText('Nhắn tin không giới hạn', { exact: true })).toBeVisible();
    await expect(page.getByText('Huy hiệu thành viên trả phí', { exact: true })).toBeVisible();

    await testInfo.attach('lx13-desktop-upgrade-gate', {
      body: await page.screenshot({ fullPage: false }),
      contentType: 'image/png',
    });

    await page.getByTestId('luxy-message-upgrade-cta').click();
    await expect(page.getByTestId('luxy-membership-settings')).toBeVisible();
  } finally {
    await context.close();
  }
});

test('LX-13 mobile Member Profile keeps Seeking hierarchy and gates profile messaging for Free', async ({ browser }, testInfo) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  try {
    await login(page, 'luxy-search-mobile');
    await openCreatorProfile(page);

    await expect(page.getByTestId('luxy-member-profile-hero-photo')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nhắn tin', exact: true })).toBeVisible();
    await expect(page.getByTestId('luxy-membership-badge-diamond').first()).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await testInfo.attach('lx13-mobile-member-profile', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });

    await page.getByRole('button', { name: 'Nhắn tin', exact: true }).click();
    await expect(page.getByTestId('luxy-message-upgrade-gate')).toBeVisible();
    await expect(page.getByTestId('luxy-message-upgrade-cta')).toBeVisible();
    await page.getByRole('button', { name: 'Để sau' }).click();
    await expect(page.getByTestId('luxy-message-upgrade-gate')).toHaveCount(0);
  } finally {
    await context.close();
  }
});