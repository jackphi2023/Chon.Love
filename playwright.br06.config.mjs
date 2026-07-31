import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/br-06',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: process.env.CI
    ? [['line'], ['html', { outputFolder: 'playwright-report/br-06', open: 'never' }]]
    : [['list'], ['html', { outputFolder: 'playwright-report/br-06', open: 'never' }]],
  outputDir: 'test-results/br-06',
  use: {
    baseURL: process.env.BR06_BASE_URL || 'http://127.0.0.1:8081',
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'CI=1 pnpm --filter @myfan/mobile exec expo start --web --port 8081',
    url: 'http://127.0.0.1:8081',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
