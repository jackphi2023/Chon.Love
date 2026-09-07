import { expect, test } from '@playwright/test';

const ADMIN_BASE_URL = process.env.BR06_ADMIN_BASE_URL || 'http://127.0.0.1:3001';
const password = process.env.BR06_E2E_PASSWORD || 'Br06-local-only-2026!';
const adminEmail = 'br06.moderator@example.test';
const tinyImage = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="150"><rect width="120" height="150" fill="#ddd"/><circle cx="60" cy="50" r="25" fill="#999"/></svg>');

const newestUser = {
  user_id: '11111111-1111-4111-8111-111111111111',
  email: 'newest@example.test',
  username: 'newest_member',
  display_name: 'Newest Member',
  gender: 'female',
  age: 29,
  profile_status: 'active',
  discovery_enabled: true,
  last_active_at: '2026-09-07T08:00:00.000Z',
  signup_at: '2026-09-07T07:55:00.000Z',
  membership_tier: 'free',
  membership_expires_at: null,
  identity_status: 'approved',
  linkedin_status: 'not_submitted',
  reports_received: 0,
  blocks_received: 0,
};

const olderUser = {
  ...newestUser,
  user_id: '22222222-2222-4222-8222-222222222222',
  email: 'older@example.test',
  username: 'older_member',
  display_name: 'Older Member',
  signup_at: '2026-09-06T07:55:00.000Z',
};

function corsJson(body) {
  return {
    status: 200,
    contentType: 'application/json',
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
    },
    body: JSON.stringify(body),
  };
}

async function installAdminRoutes(page) {
  await page.route('**/rest/v1/rpc/is_super_admin', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
      return;
    }
    await route.fulfill(corsJson(true));
  });

  await page.route('**/functions/v1/user-admin', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
      return;
    }
    const body = route.request().postDataJSON();
    if (body.action === 'list') {
      await route.fulfill(corsJson({ items: [newestUser, olderUser] }));
      return;
    }
    if (body.action === 'listing_queue') {
      await route.fulfill(corsJson({ items: [] }));
      return;
    }
    if (body.action === 'detail') {
      await route.fulfill(corsJson({
        item: {
          account: {
            user_id: newestUser.user_id,
            email: newestUser.email,
            created_at: newestUser.signup_at,
            last_sign_in_at: '2026-09-07T08:10:00.000Z',
          },
          profile: {
            public_profile_code: 'abc123',
            username: newestUser.username,
            display_name: newestUser.display_name,
            profile_status: 'active',
          },
          membership: { tier: 'free' },
          verification: { identity_status: 'approved', linkedin_status: 'not_submitted' },
          age: newestUser.age,
          account_status: 'active',
          media: [
            {
              id: '33333333-3333-4333-8333-333333333333',
              media_type: 'image',
              mime_type: 'image/jpeg',
              visibility: 'avatar',
              moderation_status: 'approved',
              moderation_reason_code: null,
              uploaded_at: '2026-09-07T07:56:00.000Z',
              created_at: '2026-09-07T07:56:00.000Z',
              width: 900,
              height: 1200,
              signed_url: tinyImage,
            },
          ],
          verification_selfies: [
            { signed_url: tinyImage, created_at: '2026-09-07T07:57:00.000Z' },
          ],
          share_profile_url: 'https://www.chon.love/thanh-vien/id-abc123',
        },
      }));
      return;
    }
    await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'unexpected_action' }) });
  });
}

async function loginAdmin(page) {
  await installAdminRoutes(page);
  await page.goto(`${ADMIN_BASE_URL}/login`);
  await page.getByLabel('Email').fill(adminEmail);
  await page.getByLabel('Mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập Admin' }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
}

test('Session D Admin Users keeps newest result first and exposes created time, media, selfie and canonical profile link', async ({ page }) => {
  await loginAdmin(page);
  await page.goto(`${ADMIN_BASE_URL}/users`);

  const rows = page.locator('tbody tr');
  await expect(rows).toHaveCount(2, { timeout: 20_000 });
  await expect(rows.nth(0)).toContainText('Newest Member');
  await expect(rows.nth(1)).toContainText('Older Member');

  await rows.nth(0).getByRole('button', { name: 'Chi tiết' }).click();
  await expect(page.getByRole('heading', { name: 'Hồ sơ: Newest Member' })).toBeVisible();
  await expect(page.getByText('Tạo tài khoản', { exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Ảnh đại diện của thành viên' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Selfie xác thực 1' })).toBeVisible();
  const shareLink = page.getByRole('link', { name: 'Xem hồ sơ chia sẻ' });
  await expect(shareLink).toHaveAttribute('href', 'https://www.chon.love/thanh-vien/id-abc123');
});

test('Session D Admin photo verification UI exposes bounded pagination controls', async ({ page }) => {
  await loginAdmin(page);

  let requestedOffsets = [];
  await page.route('**/functions/v1/member-photo-verification', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
      return;
    }
    const body = route.request().postDataJSON();
    if (body.action === 'admin_list') {
      requestedOffsets.push(body.offset);
      const count = body.offset === 0 ? 50 : 1;
      const items = Array.from({ length: count }, (_, index) => ({
        case_id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(body.offset + index).padStart(12, '0')}`,
        user_id: newestUser.user_id,
        username: `queue_${body.offset + index}`,
        display_name: `Queue ${body.offset + index}`,
        declared_gender: 'female',
        profile_status: 'pending_review',
        case_status: 'queued',
        priority: 'high',
        max_similarity: null,
        automated_score_json: { pendingReason: 'manual_review_required' },
        created_at: '2026-09-07T08:00:00.000Z',
      }));
      await route.fulfill(corsJson({ items }));
      return;
    }
    await route.fulfill(corsJson({ selfieUrl: tinyImage, referenceImages: [] }));
  });

  await page.goto(`${ADMIN_BASE_URL}/member-verifications`);
  await expect(page.getByLabel('Phân trang xác minh ảnh')).toContainText('Trang 1');
  await expect(page.getByTestId('admin-photo-verification-row')).toHaveCount(50);
  await page.getByRole('button', { name: 'Trang sau' }).click();
  await expect(page.getByLabel('Phân trang xác minh ảnh')).toContainText('Trang 2');
  await expect(page.getByTestId('admin-photo-verification-row')).toHaveCount(1);
  expect(requestedOffsets).toContain(0);
  expect(requestedOffsets).toContain(50);
});
