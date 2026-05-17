import { defineConfig, devices } from '@playwright/test'

delete process.env.NO_COLOR

export default defineConfig({
  testDir: './specs',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
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
    command: 'pnpm dev:web',
    url: 'http://localhost:1420',
    reuseExistingServer: true,
    timeout: 60000,
    env: {
      ...process.env,
      NO_COLOR: '',
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
