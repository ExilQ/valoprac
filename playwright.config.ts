import {defineConfig} from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  retries: 0,
  workers: 1,
  reporter: 'line',
  outputDir: 'artifacts/playwright',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    browserName: 'chromium',
    channel: 'chrome',
    headless: true,
    viewport: {width: 1280, height: 800},
    launchOptions: {args: ['--no-sandbox', '--disable-dev-shm-usage']},
  },
  webServer: {
    command: 'pnpm exec vite preview --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173/settings.html',
    timeout: 30000,
    reuseExistingServer: !process.env.CI,
  },
});
