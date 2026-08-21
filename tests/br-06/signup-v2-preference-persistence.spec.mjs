import { expect, test } from '@playwright/test';

const password = process.env.BR06_E2E_PASSWORD || 'Br06-local-only-2026!';
const draftKey = 'chon.signup.onboarding-v2';

async function readSignupOtp(email) {
  const query = encodeURIComponent(`to:"${email}"`);
  const url = `http://127.0.0.1:54324/view/latest.html?query=${query}`;
  const deadline = Date.now() + 15_000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const html = await response.text();
        const match = html.match(/letter-spacing:\s*8px[^>]*>\s*(\d{6})\s*<\/div>/u);
        if (match) return match[1];
      }
    } catch {
      // Local mail capture may take a moment to become reachable.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Signup OTP email not captured for ${email}`);
}

test('Signup V2 restores Step 1 from auth metadata after browser draft is lost', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/auth');

  await page.getByRole('radio', { name: 'Nam', exact: true }).first().click();
  await page.getByRole('radio', { name: 'Nữ', exact: true }).last().click();
  await page.getByRole('button', { name: 'Tiếp tục đăng ký' }).click();

  const uniqueEmail = `br06-persist-${Date.now()}@example.test`;
  await page.getByLabel('Email', { exact: true }).fill(uniqueEmail);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Tạo tài khoản bằng email' }).click();

  const otpStep = page.getByTestId('signup-email-otp-step');
  await expect(otpStep.getByRole('heading', { name: 'Xác thực email', exact: true })).toBeVisible({ timeout: 30_000 });
  const otp = await readSignupOtp(uniqueEmail);

  // Reproduce the reported failure mode: the email verification path resumes
  // without the original tab-scoped draft. User metadata must be sufficient to
  // recover Step 1 and continue directly to Personal Info.
  await page.evaluate((key) => {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  }, draftKey);

  await page.getByLabel('Mã OTP', { exact: true }).fill(otp);
  await otpStep.getByRole('button', { name: 'Tiếp tục', exact: true }).click();

  const personalInfo = page.getByTestId('chon-onboarding-personal-info');
  await expect(personalInfo.getByRole('heading', { name: 'Thông tin cá nhân', exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(personalInfo.getByText(/Đang tìm/u)).toHaveCount(0);
  await expect(personalInfo.getByText(/Không tìm thấy lựa chọn giới tính/u)).toHaveCount(0);

  const selectIds = [
    'signup-height',
    'signup-weight',
    'signup-education',
    'signup-relationship',
    'signup-children',
    'signup-drinking',
    'signup-smoking',
  ];
  const boxes = [];
  for (const testId of selectIds) {
    const box = await personalInfo.getByTestId(testId).boundingBox();
    expect(box, `${testId} should be rendered`).not.toBeNull();
    boxes.push(box);
  }
  for (const box of boxes) expect(box.width).toBeGreaterThan(300);
  for (let index = 1; index < boxes.length; index += 1) {
    expect(boxes[index].y).toBeGreaterThan(boxes[index - 1].y);
  }

  const overflow = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
});
