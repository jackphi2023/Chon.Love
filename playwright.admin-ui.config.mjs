import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/admin-ui',
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/admin-ui', open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:3000',
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'pnpm --filter @myfan/admin dev --port 3000',
    url: 'http://127.0.0.1:3000/admin/login/',
    timeout: 120_000,
    env: { NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'admin-ui-local-fixture' },
  },
});
