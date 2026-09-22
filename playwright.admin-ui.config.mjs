import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/admin-ui',
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/admin-ui', open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3000',
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'pnpm --filter @myfan/admin dev --hostname localhost --port 3000',
    url: 'http://localhost:3000/admin/login/',
    timeout: 120_000,
    env: { NEXT_PUBLIC_SUPABASE_URL: 'https://admin-ui.example.test', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'admin-ui-local-fixture' },
  },
});
