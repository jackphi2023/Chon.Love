import { expect, test } from '@playwright/test';

const homepageSeoTitle = 'Trang chủ | Chọn.love - Chọn đúng Người, Yêu đúng Gu';
const colors = {
  red: 'rgb(217, 45, 42)',
  gold: 'rgb(255, 187, 0)',
  pink: 'rgb(250, 245, 242)',
};
const navLogoScale = 1.16;

async function assertNoHorizontalOverflow(page) {
  const metrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
}

async function assertNavigationLogoRendered(page) {
  const header = page.getByTestId('chon-public-header');
  const logo = header.getByTestId('chon-love-wordmark');
  await expect(logo).toBeVisible();
  await expect(logo).toHaveAttribute('role', 'img');
  await expect(logo).toHaveAttribute('aria-label', 'Chọn.Love');

  const box = await logo.boundingBox();
  expect(box).not.toBeNull();
  const baseHeight = (page.viewportSize()?.width ?? 1280) < 768 ? 22 : 26;
  expect(Math.abs(box.height - (baseHeight * navLogoScale))).toBeLessThanOrEqual(1);
  expect(Math.abs(box.width / box.height - (420 / 184))).toBeLessThanOrEqual(0.05);
}

async function assertPrimaryHomepageContent(page) {
  const home = page.getByTestId('chon-love-public-homepage');
  await expect(home).toBeVisible();
  await assertNavigationLogoRendered(page);
  await expect(home.getByText('Chọn đúng Người, Yêu đúng Gu', { exact: true }).first()).toBeVisible();
  await expect(home.getByText('NỀN TẢNG HẸN HÒ THỰC CHẤT VÀ THÚ VỊ', { exact: true }).first()).toBeVisible();
  await expect(home.getByText('CHIA SẺ TỪ THÀNH VIÊN:', { exact: true }).first()).toBeVisible();
  await expect(home.getByText('QUYỀN LỢI THÀNH VIÊN', { exact: true }).first()).toBeVisible();
  await expect(home.getByText('QUYỀN LỢI THÀNH VIÊN:', { exact: true })).toHaveCount(0);
  await expect(home.getByText('SỨ MỆNH CỦA CHÚNG TÔI', { exact: true }).first()).toBeVisible();
  await expect(home.getByRole('button', { name: 'Tham gia ngay', exact: true }).last()).toBeVisible();
  await expect(home.getByText('Tham gia Chọn.love', { exact: true })).toHaveCount(0);
  await expect(home.getByText('VĂN HOÁ KẾT NỐI CỦA CHỌN.LOVE', { exact: true }).first()).toBeVisible();
  await expect(home.getByText('Chọn đúng người, Yêu đúng Gu', { exact: true }).last()).toBeVisible();
  await expect(home.getByText('© 2026 Chon.Love', { exact: true })).toBeVisible();
  await expect(home.getByText('Điều khoản', { exact: true }).first()).toBeVisible();
  await expect(home.getByText('Tiêu chuẩn cộng đồng', { exact: true }).first()).toBeVisible();
  return home;
}

async function assertHomepagePalette(home) {
  for (const label of ['CHỌN.LOVE', 'THÀNH VIÊN NÓI GÌ', 'TRẢI NGHIỆM KHÁC BIỆT', 'SỨ MỆNH', 'VĂN HOÁ']) {
    await expect(home.getByText(label, { exact: true }).first()).toHaveCSS('color', colors.red);
  }
  for (const heading of [
    'NỀN TẢNG HẸN HÒ THỰC CHẤT VÀ THÚ VỊ',
    'QUYỀN LỢI THÀNH VIÊN',
    'VĂN HOÁ KẾT NỐI CỦA CHỌN.LOVE',
  ]) {
    await expect(home.getByText(heading, { exact: true }).first()).toHaveCSS('color', colors.gold);
    await expect(home.getByText(heading, { exact: true }).first()).toHaveCSS('font-size', '26px');
  }

  const cultureHeart = home.getByText('♥', { exact: true }).first();
  await expect(cultureHeart).toHaveCSS('color', colors.gold);
  await expect(cultureHeart.locator('xpath=..')).toHaveCSS('background-color', colors.red);

  const firstCultureItem = home.getByText('Hẹn hò xác thực thành viên.', { exact: true }).locator('xpath=../..');
  await expect(firstCultureItem.getByText('01', { exact: true })).toHaveCount(0);

  const firstBenefitNumber = home.getByText('01', { exact: true }).first();
  await expect(firstBenefitNumber).toHaveCSS('color', colors.gold);

  const pinkSectionCount = await home.locator('*').evaluateAll(
    (nodes, pink) => nodes.filter((node) => getComputedStyle(node).backgroundColor === pink).length,
    colors.pink,
  );
  expect(pinkSectionCount).toBeGreaterThanOrEqual(3);
}

test('public homepage follows the refreshed Chọn.love hierarchy and palette on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');

  await expect(page).toHaveTitle(homepageSeoTitle);
  const home = await assertPrimaryHomepageContent(page);
  await assertHomepagePalette(home);

  const leftArtwork = home.getByLabel('Minh họa kết nối Chọn.love');
  const rightArtwork = home.getByLabel('Minh họa hẹn hò Chọn.love');
  await expect(leftArtwork).toHaveCount(1);
  await expect(rightArtwork).toHaveCount(1);
  for (const artwork of [leftArtwork, rightArtwork]) {
    const frame = artwork.locator('xpath=..');
    const box = await frame.boundingBox();
    expect(box).not.toBeNull();
    expect(Math.abs(box.height - 296)).toBeLessThanOrEqual(1);
    expect(Math.abs(box.width - 216)).toBeLessThanOrEqual(1);
  }

  const heroSlogan = home.getByText('Chọn đúng Người, Yêu đúng Gu', { exact: true }).first();
  await expect(heroSlogan).toHaveCSS('font-size', '36px');
  await expect(heroSlogan).toHaveCSS('margin-top', '8px');

  const testimonialCard = home.getByText('Steven Nguyễn', { exact: true }).first().locator('xpath=..');
  await expect(testimonialCard).toHaveCSS('background-color', 'rgba(255, 241, 200, 0.88)');
  await expect(home.getByText('Steven Nguyễn', { exact: true }).first()).toBeVisible();
  await expect(home.getByText('Thanh Hiền', { exact: true }).first()).toBeVisible();
  await expect(home.getByText('Hải Yến', { exact: true }).first()).toBeVisible();

  await expect(home.getByRole('button', { name: 'Đăng nhập', exact: true }).first()).toBeVisible();
  const register = home.getByRole('button', { name: 'Đăng ký', exact: true }).first();
  await expect(register).toBeVisible();
  const registerBefore = await register.evaluate((node) => getComputedStyle(node).backgroundColor);
  await register.hover();
  await expect(register).not.toHaveCSS('background-color', registerBefore);
  const registerShadow = await register.evaluate((node) => getComputedStyle(node).boxShadow);
  expect(registerShadow).not.toBe('none');

  await expect(home.getByText('Cách hoạt động', { exact: true })).toHaveCount(0);
  await expect(home.getByText('Giá trị Luxy', { exact: true })).toHaveCount(0);
  await assertNoHorizontalOverflow(page);

  const footer = page.getByTestId('chon-public-footer');
  const footerCopyright = footer.getByText('© 2026 Chon.Love', { exact: true });
  const footerLinks = footer.getByRole('link');
  const copyrightBox = await footerCopyright.boundingBox();
  const lastLinkBox = await footerLinks.last().boundingBox();
  expect(copyrightBox).not.toBeNull();
  expect(lastLinkBox).not.toBeNull();
  expect(copyrightBox.x).toBeGreaterThan(lastLinkBox.x);

  await test.info().attach('chon-love-home-desktop-1280', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
});

test('homepage sends Login and Join to their intended auth modes', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');

  const home = page.getByTestId('chon-love-public-homepage');
  await home.getByRole('button', { name: 'Đăng nhập', exact: true }).first().click();
  await expect(page).toHaveURL(/\/auth\?mode=login$/);
  const loginScreen = page.getByTestId('luxy-auth-screen');
  await expect(loginScreen).toBeVisible();
  await expect(loginScreen.getByRole('heading', { name: 'Đăng nhập', exact: true })).toBeVisible();

  await page.goto('/');
  const refreshedHome = page.getByTestId('chon-love-public-homepage');
  await refreshedHome.getByRole('button', { name: 'Tham gia Chọn.love ngay' }).first().click();
  await expect(page).toHaveURL(/\/auth$/);
  const joinScreen = page.getByTestId('luxy-auth-screen');
  await expect(joinScreen).toBeVisible();
  await expect(joinScreen.getByRole('heading', { name: 'Đăng ký', exact: true })).toBeVisible();
});

for (const viewport of [
  { width: 390, height: 844, name: '390' },
  { width: 430, height: 932, name: '430' },
]) {
  test(`public homepage fits mobile ${viewport.name}px with compact three-row footer`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/');

    const home = await assertPrimaryHomepageContent(page);
    await assertHomepagePalette(home);
    await expect(home.getByLabel('Minh họa kết nối Chọn.love')).toHaveCount(0);
    await expect(home.getByLabel('Minh họa hẹn hò Chọn.love')).toHaveCount(0);

    const benefitArtwork = home.getByLabel('Minh họa quyền lợi thành viên Chọn.love').first();
    await expect(benefitArtwork).toBeVisible();

    await expect(home.getByText('Đăng nhập', { exact: true }).first()).toBeVisible();
    await expect(home.getByText('Đăng ký', { exact: true }).first()).toBeVisible();
    await expect(home.getByRole('button', { name: 'Mở menu' })).toHaveCount(0);
    await expect(home.getByText('Steven Nguyễn', { exact: true }).first()).toBeVisible();

    const nextTestimonial = home.getByRole('button', { name: 'Chia sẻ tiếp theo' }).first();
    await expect(nextTestimonial).toBeVisible();
    await nextTestimonial.click();
    await expect(home.getByText('Thanh Hiền', { exact: true }).first()).toBeVisible();

    const cta = home.getByRole('button', { name: 'Tham gia Chọn.love ngay' }).first();
    const ctaBox = await cta.boundingBox();
    expect(ctaBox).not.toBeNull();
    expect(ctaBox.height).toBeGreaterThanOrEqual(44);

    const footer = page.getByTestId('chon-public-footer');
    const footerSlogan = footer.getByText('Chọn đúng người, Yêu đúng Gu', { exact: true });
    const firstLegalLink = footer.getByRole('link').first();
    const footerCopyright = footer.getByText('© 2026 Chon.Love', { exact: true });
    await expect(footerSlogan).toBeVisible();
    await expect(firstLegalLink).toBeVisible();
    await expect(footerCopyright).toBeVisible();
    const sloganBox = await footerSlogan.boundingBox();
    const legalBox = await firstLegalLink.boundingBox();
    const copyrightBox = await footerCopyright.boundingBox();
    expect(sloganBox).not.toBeNull();
    expect(legalBox).not.toBeNull();
    expect(copyrightBox).not.toBeNull();
    expect(legalBox.y).toBeGreaterThan(sloganBox.y);
    expect(copyrightBox.y).toBeGreaterThan(legalBox.y);
    const footerBox = await footer.boundingBox();
    expect(footerBox).not.toBeNull();
    expect(footerBox.height).toBeLessThan(130);

    await assertNoHorizontalOverflow(page);
    await test.info().attach(`chon-love-home-mobile-${viewport.name}`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });
}
