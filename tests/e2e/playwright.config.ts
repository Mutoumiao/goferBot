import { defineConfig, devices } from '@playwright/test'
import path from 'path'

delete process.env.NO_COLOR

export default defineConfig({
  testDir: './specs',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // 串行执行，避免数据库状态冲突
  globalSetup: path.resolve(__dirname, './playwright.global-setup.ts'),
  globalTeardown: path.resolve(__dirname, './playwright.global-teardown.ts'),
  reporter: [
    ['list'],
    ['html', { outputFolder: './report', open: 'never' }],
  ],
  use: {
    baseURL: 'http://localhost:1420',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },
  webServer: {
    command: 'concurrently "pnpm dev:server" "pnpm dev:web" --names server,web --prefix-colors cyan,green',
    url: 'http://localhost:1420',
    reuseExistingServer: !process.env.CI, // CI 强制启动新实例
    timeout: 120000,
    env: {
      ...process.env,
      NO_COLOR: '',
      NODE_ENV: 'test',
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
