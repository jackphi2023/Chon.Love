import { expect, test } from '@playwright/test';

const ADMIN_BASE_URL = process.env.BR06_ADMIN_BASE_URL || 'http://127.0.0.1:3100';
const password = process.env.BR06_E2E_PASSWORD || 'Br06-local-only-2026!';
const adminActor = { email: 'br06.moderator@example.test' };
const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z1ioAAAAASUVORK5CYII=',
  'base64',
);

function json(route, body) {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function loginAdmin(page) {
  await page.goto(`${ADMIN_BASE_URL}/login`);
  await expect(page.getByRole('heading', { name: 'Chon.Love Admin', exact: true })).toBeVisible();
  await page.getByLabel('Email').fill(adminActor.email);
  await page.getByLabel('Mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập Admin', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
}

function adminUser(overrides = {}) {
  return {
    user_id: '66000000-0000-4000-8000-000000000001',
    email: 'newest@example.test',
    username: 'newest_user',
    display_name: 'Newest User',
    gender: 'female',
    age: 31,
    profile_status: 'active',
    discovery_enabled: true,
    last_active_at: '2026-09-07T08:10:00.000Z',
    membership_tier: 'premium',
    membership_expires_at: '2026-10-07T08:00:00.000Z',
    identity_status: 'approved',
    linkedin_status: 'approved',
    reports_received: 0,
    blocks_received: 0,
    ...overrides,
  };
}

function photoCase(index, pageTwo = false) {
  const sequence = String(index).padStart(12, '0');
  return {
    case_id: `77000000-0000-4000-8000-${sequence}`,
    user_id: '66000000-0000-4000-8000-000000000001',
    username: `photo_case_${index}`,
    display_name: index === 1 ? 'Newest Photo Case' : pageTwo ? `Page 2 Photo Case ${index}` : `Photo Case ${index}`,
    declared_gender: 'female',
    profile_status: 'pending_review',
    case_status: 'queued',
    priority: 'high',
    max_similarity: 59.5 - index / 100,
    automated_score_json: {
      provider: 'aws_rekognition_compare_faces',
      pendingReason: 'face_similarity_not_above_threshold',
    },
    created_at: new Date(Date.UTC(2026, 8, 7, 9, 0, 0) - index * 60_000).toISOString(),
  };
}

test('Session D Admin Users and photo-verification surfaces preserve newest-first evidence and pagination', async ({ page }) => {
  const userAdminRequests = [];
  const photoAdminRequests = [];
  const newest = adminUser();
  const older = adminUser({
    user_id: '66000000-0000-4000-8000-000000000002',
    email: 'older@example.test',
    username: 'older_user',
    display_name: 'Older User',
    last_active_at: '2026-09-06T08:10:00.000Z',
    membership_tier: 'free',
    membership_expires_at: null,
    identity_status: 'not_submitted',
    linkedin_status: 'not_submitted',
  });

  await page.route('https://cdn.example.test/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'image/png', body: ONE_PIXEL_PNG });
  });

  await page.route('**/functions/v1/user-admin', async (route) => {
    const body = route.request().postDataJSON();
    userAdminRequests.push(body);
    if (body.action === 'list') {
      await json(route, { items: [newest, older] });
      return;
    }
    if (body.action === 'listing_queue') {
      await json(route, { items: [] });
      return;
    }
    if (body.action === 'detail' && body.userId === newest.user_id) {
      await json(route, {
        item: {
          account: {
            user_id: newest.user_id,
            email: newest.email,
            created_at: '2026-09-07T08:00:00.000Z',
            last_sign_in_at: '2026-09-07T08:12:00.000Z',
          },
          profile: {
            public_profile_code: 'abc123',
            username: newest.username,
            display_name: newest.display_name,
            profile_status: 'active',
          },
          membership: { tier: 'premium' },
          verification: { identity_status: 'approved', linkedin_status: 'approved' },
          age: 31,
          account_status: 'active',
          media: [
            {
              id: '88000000-0000-4000-8000-000000000001',
              media_type: 'image',
              mime_type: 'image/jpeg',
              visibility: 'avatar',
              moderation_status: 'approved',
              moderation_reason_code: null,
              uploaded_at: '2026-09-07T08:05:00.000Z',
              created_at: '2026-09-07T08:04:00.000Z',
              width: 1200,
              height: 1600,
              signed_url: 'https://cdn.example.test/admin-avatar.png',
            },
            {
              id: '88000000-0000-4000-8000-000000000002',
              media_type: 'image',
              mime_type: 'image/jpeg',
              visibility: 'public',
              moderation_status: 'pending_review',
              moderation_reason_code: null,
              uploaded_at: '2026-09-07T08:06:00.000Z',
              created_at: '2026-09-07T08:06:00.000Z',
              width: 1080,
              height: 1350,
              signed_url: 'https://cdn.example.test/admin-public.png',
            },
          ],
          verification_selfies: [
            {
              signed_url: 'https://cdn.example.test/admin-selfie.png',
              created_at: '2026-09-07T08:07:00.000Z',
            },
          ],
          share_profile_url: 'https://www.chon.love/thanh-vien/id-abc123',
        },
      });
      return;
    }
    await json(route, { error: 'unexpected_user_admin_fixture_request' });
  });

  await page.route('**/functions/v1/member-photo-verification', async (route) => {
    const body = route.request().postDataJSON();
    photoAdminRequests.push(body);
    if (body.action === 'admin_list' && body.offset === 0) {
      await json(route, { items: Array.from({ length: 50 }, (_, index) => photoCase(index + 1)) });
      return;
    }
    if (body.action === 'admin_list' && body.offset === 50) {
      await json(route, { items: [photoCase(51, true), photoCase(52, true)] });
      return;
    }
    if (body.action === 'admin_detail') {
      await json(route, {
        item: { id: body.caseId },
        selfieUrl: 'https://cdn.example.test/review-selfie.png',
        referenceImages: [
          { mediaId: '99000000-0000-4000-8000-000000000001', signedUrl: 'https://cdn.example.test/review-reference-1.png' },
          { mediaId: '99000000-0000-4000-8000-000000000002', signedUrl: 'https://cdn.example.test/review-reference-2.png' },
        ],
      });
      return;
    }
    await json(route, { error: 'unexpected_photo_admin_fixture_request' });
  });

  await loginAdmin(page);

  await page.goto(`${ADMIN_BASE_URL}/users`);
  await expect(page.getByRole('heading', { name: 'Quản lý thành viên', exact: true })).toBeVisible({ timeout: 30_000 });
  const userRows = page.locator('tbody tr');
  await expect(userRows).toHaveCount(2);
  await expect(userRows.nth(0)).toContainText('Newest User');
  await expect(userRows.nth(1)).toContainText('Older User');
  expect(userAdminRequests.some((body) => body.action === 'list' && body.limit === 100 && body.offset === 0)).toBe(true);

  await userRows.nth(0).getByRole('button', { name: 'Chi tiết', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Hồ sơ: Newest User', exact: true })).toBeVisible();
  await expect(page.getByText('Tạo tài khoản', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ảnh hồ sơ (2)', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Selfie xác thực (1)', exact: true })).toBeVisible();
  await expect(page.getByAltText('Ảnh đại diện của thành viên')).toBeVisible();
  await expect(page.getByAltText('Selfie xác thực 1')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Xem hồ sơ chia sẻ', exact: true })).toHaveAttribute(
    'href',
    'https://www.chon.love/thanh-vien/id-abc123',
  );

  await page.goto(`${ADMIN_BASE_URL}/member-verifications`);
  const queue = page.getByTestId('admin-member-photo-verification-queue');
  await expect(queue).toBeVisible({ timeout: 30_000 });
  let cards = page.locator('[data-testid^="admin-photo-verification-case-"]');
  await expect(cards).toHaveCount(50);
  await expect(cards.first()).toContainText('Newest Photo Case');
  expect(photoAdminRequests.some((body) => body.action === 'admin_list' && body.limit === 50 && body.offset === 0)).toBe(true);

  await page.getByTestId('admin-photo-verification-load-more').click();
  cards = page.locator('[data-testid^="admin-photo-verification-case-"]');
  await expect(cards).toHaveCount(52);
  await expect(cards.nth(50)).toContainText('Page 2 Photo Case 51');
  expect(photoAdminRequests.some((body) => body.action === 'admin_list' && body.limit === 50 && body.offset === 50)).toBe(true);
  await expect(page.getByTestId('admin-photo-verification-load-more')).toHaveCount(0);

  const cardIds = await cards.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-testid')));
  expect(new Set(cardIds).size).toBe(cardIds.length);

  await cards.first().getByRole('button', { name: 'Xem selfie + ảnh upload', exact: true }).click();
  const detail = page.getByTestId('admin-photo-verification-detail');
  await expect(detail).toBeVisible();
  await expect(detail.getByAltText('Selfie live')).toBeVisible();
  await expect(detail.getByAltText('Ảnh upload 1')).toBeVisible();
  await expect(detail.getByAltText('Ảnh upload 2')).toBeVisible();
});
