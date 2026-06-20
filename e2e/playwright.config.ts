import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const webServerUrl = process.env.WEB_SERVER_URL || 'http://localhost:1420'

export default defineConfig({
  testDir: path.resolve(__dirname, './specs'),
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: path.resolve(__dirname, './report'), open: 'never' }],
  ],
  outputDir: path.resolve(__dirname, './artifacts'),
  globalSetup: path.resolve(__dirname, './playwright.global-setup.ts'),
  globalTeardown: path.resolve(__dirname, './playwright.global-teardown.ts'),
  use: {
    baseURL: webServerUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.WEB_SERVER_URL
    ? undefined
    : {
        command: 'pnpm --filter @goferbot/web dev',
        url: 'http://localhost:1420',
        reuseExistingServer: true,
        timeout: 120_000,
        env: {
          ...process.env,
          // 强制使用 goferbot_e2e 数据库
          DATABASE_URL:
            'postgresql://gofer:gofer_dev_pass@127.0.0.1:5432/goferbot_e2e?schema=public',
        },
      },
})
