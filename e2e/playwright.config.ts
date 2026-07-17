import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const webServerUrl = process.env.WEB_SERVER_URL || 'http://localhost:1420'
const apiServerUrl = process.env.API_SERVER_URL || 'http://localhost:3100'
const e2eDatabaseUrl =
  process.env.E2E_DATABASE_URL ||
  'postgresql://gofer:gofer_dev_pass@127.0.0.1:5432/goferbot_e2e?schema=public'

// CI 或不复用时强制起新进程，避免粘连旧 HMR/坏 chunk（如 useActiveEffect 白屏）
const reuseExistingServer = process.env.PW_REUSE_SERVER === '1' || !process.env.CI

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
    : [
        {
          command: 'pnpm --filter @goferbot/server dev',
          url: `${apiServerUrl}/health`,
          reuseExistingServer,
          timeout: 180_000,
          env: {
            ...process.env,
            DATABASE_URL: e2eDatabaseUrl,
            PORT: '3100',
          },
        },
        {
          command: 'pnpm --filter @goferbot/web dev',
          url: webServerUrl,
          reuseExistingServer,
          timeout: 120_000,
          env: {
            ...process.env,
            DATABASE_URL: e2eDatabaseUrl,
          },
        },
      ],
})
