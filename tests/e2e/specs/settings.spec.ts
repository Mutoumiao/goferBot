import { test, expect } from '@playwright/test'
import { SettingsPage } from '../pages/SettingsPage'
import { injectMockShell } from '../mocks/shell-memory'
import { mockHttpRoutes } from '../mocks/http-routes'

test.beforeEach(async ({ page }) => {
  await injectMockShell(page)
  await mockHttpRoutes(page)
})

test('settings page navigation renders tabs', async ({ page }) => {
  const settings = new SettingsPage(page)
  await settings.goto()
  await expect(settings.navTabs).toBeVisible()
  await expect(settings.navTabs.locator('text=OpenAI')).toBeVisible()
  await expect(settings.navTabs.locator('text=Claude')).toBeVisible()
  await expect(settings.navTabs.locator('text=DeepSeek')).toBeVisible()
})

test('tab singleton: switching tabs preserves state', async ({ page }) => {
  const settings = new SettingsPage(page)
  await settings.goto()
  await settings.clickTab('Claude')
  await settings.fillInput('model', 'claude-test-model')
  await settings.clickTab('OpenAI')
  await settings.clickTab('Claude')
  const input = page.locator('[data-testid="settings-form"] [name="model"]')
  await expect(input).toHaveValue('claude-test-model')
})

test('form save triggers API call', async ({ page }) => {
  const settings = new SettingsPage(page)
  let saved = false
  await page.route('http://127.0.0.1:*/settings', (route) => {
    if (route.request().method() === 'POST') {
      saved = true
      return route.fulfill({ json: { success: true } })
    }
    route.continue()
  })
  await settings.goto()
  await settings.fillInput('apiKey', 'test-key')
  await settings.save()
  expect(saved).toBe(true)
})

test('error hint displayed on save failure', async ({ page }) => {
  const settings = new SettingsPage(page)
  await page.route('http://127.0.0.1:*/settings', (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({ status: 400, json: { error: 'Invalid provider' } })
    }
    route.continue()
  })
  await settings.goto()
  await settings.fillInput('apiKey', 'bad-key')
  await settings.save()
  await expect(page.locator('[data-testid="settings-error"]')).toBeVisible()
  const errors = await settings.getErrorMessages()
  expect(errors.length).toBeGreaterThan(0)
})
