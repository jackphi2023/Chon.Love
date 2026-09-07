import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/br-06',
  testMatch: ['chon-admin-session-d.spec.mjs'],
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  reporter: process.env.CI
    ? [['line'], ['html', { outputFolder: 'playwright-report/admin-session-d', open: 'never' }]]
    : [['list'], ['html', { outputFolder: 'playwright-report/admin-session-d', open: 'never' }]],
  outputDir: 'test-results/admin-session-d',
  use: {
    baseURL: process.env.BR06_ADMIN_BASE_URL || 'http://127.0.0.1:3001',
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
});