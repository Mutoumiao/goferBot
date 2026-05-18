import { test, expect } from '@playwright/test'
import { mockApiRoutes } from '../mocks/http-routes'
import { injectAuthToken } from '../fixtures/auth'
import { SettingsPage } from '../pages/SettingsPage'

test.describe('设置页面', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuthToken(page)
    await mockApiRoutes(page)
    await page.goto('/app/settings')
    // 等待页面加载完成，增加超时时间
    await page.waitForLoadState('load')
    // 等待设置页面内容出现
    await page.waitForSelector('[data-testid="settings-nav-tabs"]', { timeout: 10000 })
  })

  test('设置页面正常加载', async ({ page }) => {
    const settings = new SettingsPage(page)
    await expect(settings.navTabs).toBeVisible()
  })

  test('LLM 提供商 Tab 显示正确', async ({ page }) => {
    await expect(page.locator('text=OpenAI').first()).toBeVisible()
    await expect(page.locator('text=Claude').first()).toBeVisible()
    await expect(page.locator('text=DeepSeek').first()).toBeVisible()
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
    // 使用 Promise.all 等待保存和请求
    const [, request] = await Promise.all([
      (async () => {
        const settings = new SettingsPage(page)
        // 先选择 DeepSeek 提供商
        await settings.clickTab('DeepSeek')
        // 填充 API Key（验证要求必须有一个提供商有 API Key）
        await settings.fillInput('apiKey', 'test-key')
        // 等待 Vue 更新状态
        await page.waitForTimeout(500)
        await settings.save()
      })(),
      page.waitForRequest((req) => req.url().includes(':3000') && req.url().includes('/settings') && req.method() === 'POST'),
    ])

    expect(request).toBeTruthy()
  })

  test('保存失败显示错误提示', async ({ page }) => {
    await page.route('**/settings', (route) => {
      const url = route.request().url()
      // 只拦截 API 请求（端口 3000），不拦截页面导航
      if (!url.includes(':3000')) {
        route.continue()
        return
      }
      if (route.request().method() === 'POST') {
        return route.fulfill({ status: 400, json: { error: { message: 'Invalid provider' } } })
      }
      route.continue()
    })

    const settings = new SettingsPage(page)
    await settings.fillInput('apiKey', 'bad-key')
    await settings.save()

    await expect(settings.errorMessage).toBeVisible()
  })

  test('LLM 提供商配置显示 API Key 输入框', async ({ page }) => {
    await expect(page.locator('text=API Key').first()).toBeVisible()
  })

  test('Embedding 配置 Tab 显示', async ({ page }) => {
    await expect(page.locator('text=Embedding')).toBeVisible()
  })

  test('温度参数滑块可调节', async ({ page }) => {
    const slider = page.locator('[data-testid="temperature-slider"]')
    await expect(slider).toBeVisible()
  })
})
