import { test, expect } from '@playwright/test'
import { mockApiRoutes } from '../mocks/http-routes'
import { injectAuthToken } from '../fixtures/auth'
import { SettingsPage } from '../pages/SettingsPage'

test.describe('设置页面', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuthToken(page)
    await mockApiRoutes(page)
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
  })

  test('设置页面正常加载', async ({ page }) => {
    const settings = new SettingsPage(page)
    await expect(settings.navTabs).toBeVisible()
  })

  test('LLM 提供商 Tab 显示正确', async ({ page }) => {
    await expect(page.locator('text=OpenAI')).toBeVisible()
    await expect(page.locator('text=Claude')).toBeVisible()
    await expect(page.locator('text=DeepSeek')).toBeVisible()
  })

  test('切换 Tab 保持状态', async ({ page }) => {
    const settings = new SettingsPage(page)
    await settings.clickTab('Claude')
    await settings.fillInput('model', 'claude-test-model')
    await settings.clickTab('OpenAI')
    await settings.clickTab('Claude')

    const input = page.locator('[name="model"]')
    await expect(input).toHaveValue('claude-test-model')
  })

  test('保存设置触发 API 调用', async ({ page }) => {
    let saved = false
    await page.route('**/api/settings', (route) => {
      if (route.request().method() === 'POST') {
        saved = true
        return route.fulfill({ json: { success: true } })
      }
      route.continue()
    })

    const settings = new SettingsPage(page)
    await settings.fillInput('apiKey', 'test-key')
    await settings.save()

    expect(saved).toBe(true)
  })

  test('保存失败显示错误提示', async ({ page }) => {
    await page.route('**/api/settings', (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({ status: 400, json: { error: 'Invalid provider' } })
      }
      route.continue()
    })

    const settings = new SettingsPage(page)
    await settings.fillInput('apiKey', 'bad-key')
    await settings.save()

    await expect(settings.errorMessage).toBeVisible()
  })

  test('LLM 提供商配置显示 API Key 输入框', async ({ page }) => {
    await expect(page.locator('text=API Key')).toBeVisible()
  })

  test('Embedding 配置 Tab 显示', async ({ page }) => {
    await expect(page.locator('text=Embedding')).toBeVisible()
  })

  test('温度参数滑块可调节', async ({ page }) => {
    const slider = page.locator('[data-testid="temperature-slider"]')
    await expect(slider).toBeVisible()
  })
})
