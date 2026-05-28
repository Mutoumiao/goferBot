import { test, expect } from '@playwright/test'
import { mockApiRoutes } from '../../e2e/mocks/http-routes'
import { injectMockToken } from '../../e2e/fixtures/auth'
import { SettingsPage } from '../../e2e/pages/SettingsPage'

test.describe('设置持久化', () => {
  test.beforeEach(async ({ page }) => {
    await injectMockToken(page)
    await mockApiRoutes(page)
    await page.goto('/app/settings')
    await page.waitForLoadState('load')
    await page.waitForSelector('[data-testid="settings-nav-tabs"]', { timeout: 10000 })
  })

  test('AC-01: 设置页面正常加载', async ({ page }) => {
    const settings = new SettingsPage(page)
    await expect(settings.navTabs).toBeVisible()
    await expect(page.locator('text=模型设置').first()).toBeVisible()
    await expect(page.locator('text=账户设置').first()).toBeVisible()
  })

  test('AC-02: LLM 提供商 Tab 显示正确', async ({ page }) => {
    await expect(page.locator('[data-testid="tab-openai"]')).toBeVisible()
    await expect(page.locator('[data-testid="tab-claude"]')).toBeVisible()
    await expect(page.locator('[data-testid="tab-deepseek"]')).toBeVisible()
    await expect(page.locator('[data-testid="tab-custom"]')).toBeVisible()
    await expect(page.locator('[data-testid="tab-ollama"]')).toBeVisible()
  })

  test('AC-03: 修改 API Key 并保存', async ({ page }) => {
    const settings = new SettingsPage(page)
    await settings.clickTab('Claude')
    await settings.fillInput('apiKey', 'sk-test-claude')
    await page.waitForTimeout(300)

    const [request] = await Promise.all([
      page.waitForRequest((req) => req.url().includes('/api/settings') && req.method() === 'POST'),
      settings.save(),
    ])

    expect(request).toBeTruthy()
    const body = await request.postDataJSON()
    expect(body.providers.claude.apiKey).toBe('sk-test-claude')
  })

  test('AC-04: 切换默认提供商', async ({ page }) => {
    const settings = new SettingsPage(page)
    await settings.clickTab('DeepSeek')
    await settings.fillInput('apiKey', 'sk-test-deepseek')
    await page.waitForTimeout(300)

    // 打开默认提供商下拉并选择 DeepSeek
    await page.locator('[data-testid="default-provider-select-trigger"]').click()
    await page.locator('[role="option"]:has-text("DeepSeek")').click()
    await page.waitForTimeout(300)

    const [request] = await Promise.all([
      page.waitForRequest((req) => req.url().includes('/api/settings') && req.method() === 'POST'),
      settings.save(),
    ])

    const body = await request.postDataJSON()
    expect(body.defaultChatProvider).toBe('deepseek')
  })

  test('AC-05: 刷新页面后设置恢复', async ({ page }) => {
    // 移除 beforeEach 中的 mock，替换为持久化数据的自定义路由
    await page.unroute('**/api/settings')
    await page.route('**/api/settings', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          json: {
            providers: {
              openai: { apiKey: '', model: 'gpt-4o', baseUrl: '' },
              claude: { apiKey: 'sk-persist-test', model: 'claude-3-persist', baseUrl: '' },
              deepseek: { apiKey: 'fake-api-key-for-e2e', model: 'deepseek-chat', baseUrl: '' },
              custom: { apiKey: '', model: '', baseUrl: '' },
              ollama: { enabled: false, url: 'http://localhost:11434', model: '' },
            },
            embeddingProvider: { provider: 'openai', apiKey: '', model: 'text-embedding-3-small', baseUrl: '' },
            temperature: 0.7,
            defaultChatProvider: 'deepseek',
          },
        })
      } else if (route.request().method() === 'POST') {
        route.fulfill({ json: { data: { success: true } } })
      } else {
        route.fallback()
      }
    })

    const settings = new SettingsPage(page)
    await settings.clickTab('Claude')
    await settings.fillInput('apiKey', 'sk-persist-test')
    await settings.fillInput('model', 'claude-3-persist')
    await page.waitForTimeout(300)
    await settings.save()
    await expect(settings.successMessage).toBeVisible()

    await page.reload()
    await page.waitForLoadState('load')
    await page.waitForSelector('[data-testid="settings-nav-tabs"]', { timeout: 10000 })

    await settings.clickTab('Claude')
    const apiKeyInput = page.locator('[name="apiKey"]')
    await expect(apiKeyInput).toHaveValue('sk-persist-test')
    const modelInput = page.locator('[name="model"]')
    await expect(modelInput).toHaveValue('claude-3-persist')
  })

  test('AC-06: Embedding 配置保存', async ({ page }) => {
    const settings = new SettingsPage(page)
    await expect(settings.embeddingProviderSelect).toBeVisible()
    await settings.selectEmbeddingProvider('硅基流动')
    await settings.fillEmbeddingApiKey('sk-embedding-sf')
    await settings.fillEmbeddingModel('BAAI/bge-large-zh-v1.5')
    await page.waitForTimeout(300)

    const [request] = await Promise.all([
      page.waitForRequest((req) => req.url().includes('/api/settings') && req.method() === 'POST'),
      settings.save(),
    ])

    const body = await request.postDataJSON()
    expect(body.embeddingProvider.provider).toBe('siliconflow')
    expect(body.embeddingProvider.apiKey).toBe('sk-embedding-sf')
    expect(body.embeddingProvider.model).toBe('BAAI/bge-large-zh-v1.5')
  })

  test('AC-07: 温度参数保存', async ({ page }) => {
    const settings = new SettingsPage(page)
    await settings.setTemperature(1.2)
    await page.waitForTimeout(300)

    await expect(settings.temperatureValue).toHaveText('1.2')

    const [request] = await Promise.all([
      page.waitForRequest((req) => req.url().includes('/api/settings') && req.method() === 'POST'),
      settings.save(),
    ])

    const body = await request.postDataJSON()
    expect(body.temperature).toBe(1.2)
  })

  test('AC-14: 保存无效 temperature 显示验证错误', async ({ page }) => {
    // 通过 mock GET 注入越界温度值，测试前端 validate() 校验逻辑
    await page.unroute('**/api/settings')
    await page.route('**/api/settings', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          json: {
            providers: {
              openai: { apiKey: '', model: 'gpt-4o', baseUrl: '' },
              claude: { apiKey: '', model: 'claude-3-5-sonnet-20241022', baseUrl: '' },
              deepseek: { apiKey: 'fake-api-key-for-e2e', model: 'deepseek-chat', baseUrl: '' },
              custom: { apiKey: '', model: '', baseUrl: '' },
              ollama: { enabled: false, url: 'http://localhost:11434', model: '' },
            },
            embeddingProvider: { provider: 'openai', apiKey: '', model: 'text-embedding-3-small', baseUrl: '' },
            temperature: 2.5,
            defaultChatProvider: 'deepseek',
          },
        })
      } else if (route.request().method() === 'POST') {
        route.fulfill({ json: { data: { success: true } } })
      } else {
        route.fallback()
      }
    })

    // 先 reload 使越界 temperature 加载到 localConfig
    await page.reload()
    await page.waitForLoadState('load')
    await page.waitForSelector('[data-testid="settings-nav-tabs"]', { timeout: 10000 })

    // 修改 API Key 以启用保存按钮
    const settings = new SettingsPage(page)
    await settings.clickTab('OpenAI')
    await settings.fillInput('apiKey', 'sk-test')
    await page.waitForTimeout(300)

    // 点击保存 → validate() 应检测到 temperature=2.5 越界 → 显示错误
    await settings.save()
    await expect(settings.errorMessage).toBeVisible()
    await expect(settings.errorMessage).toContainText('温度参数必须在 0-2 之间')
  })

  test('AC-15: 保存空 API Key 允许（非必填）', async ({ page }) => {
    const settings = new SettingsPage(page)
    await settings.clickTab('OpenAI')
    // 确保 API Key 为空
    await settings.fillInput('apiKey', '')
    await page.waitForTimeout(300)

    // 修改温度以启用保存按钮
    await settings.setTemperature(0.8)
    await page.waitForTimeout(300)

    const [request] = await Promise.all([
      page.waitForRequest((req) => req.url().includes('/api/settings') && req.method() === 'POST'),
      settings.save(),
    ])

    expect(request).toBeTruthy()
    const body = await request.postDataJSON()
    expect(body.providers.openai.apiKey).toBe('')
  })
})
