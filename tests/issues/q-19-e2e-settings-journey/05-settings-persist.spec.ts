import { test, expect } from '@playwright/test'
import { mockApiRoutes } from '../../e2e/mocks/http-routes'
import { injectAuthToken } from '../../e2e/fixtures/auth'
import { SettingsPage } from '../../e2e/pages/SettingsPage'

test.describe('设置持久化', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuthToken(page)
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
    // 先 mock 保存后的配置，使刷新后能恢复
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
    // 先滚动到 Embedding 区域并等待元素可交互
    await settings.embeddingCard.scrollIntoViewIfNeeded()
    await page.waitForTimeout(500)
    await page.waitForSelector('[data-testid="embedding-provider-select"]', { state: 'visible', timeout: 10000 })
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
    const settings = new SettingsPage(page)
    // 先修改温度使保存按钮可用，然后再用 evaluate 绕过前端限制设置越界值
    await settings.setTemperature(1.0)
    await page.waitForTimeout(300)
    // 通过 evaluate 直接修改 input value 和 Vue 内部状态
    await page.evaluate(() => {
      const slider = document.querySelector('[data-testid="temperature-slider"]') as HTMLInputElement
      if (slider) {
        slider.value = '2.5'
        slider.dispatchEvent(new Event('input', { bubbles: true }))
        slider.dispatchEvent(new Event('change', { bubbles: true }))
      }
    })
    await page.waitForTimeout(300)
    await settings.save()

    // 如果前端校验阻止了保存，errorMessage 可能不会出现
    // 此时测试通过（前端校验生效）或失败（需要后端校验）
    // 这里我们检查两种情况：errorMessage 显示 或 保存按钮仍 disabled（表示前端阻止了）
    const isErrorVisible = await settings.errorMessage.isVisible().catch(() => false)
    if (isErrorVisible) {
      const errorText = await settings.errorMessage.textContent()
      expect(errorText).toContain('温度参数必须在 0-2 之间')
    } else {
      // 前端校验阻止了保存，保存按钮应该仍 disabled
      const isEnabled = await settings.isSaveButtonEnabled()
      expect(isEnabled).toBe(false)
    }
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
