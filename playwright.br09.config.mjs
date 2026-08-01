import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/br-09',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  reporter: process.env.CI
    ? [['line'], ['html', { outputFolder: 'playwright-report/br-09', open: 'never' }]]
    : [['list'], ['html', { outputFolder: 'playwright-report/br-09', open: 'never' }]],
  outputDir: 'test-results/br-09',
  use: {
    baseURL: process.env.BR09_BASE_URL || 'http://127.0.0.1:8082',
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'CI=1 pnpm --filter @myfan/mobile exec expo start --web --port 8082',
    url: 'http://127.0.0.1:8082',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
