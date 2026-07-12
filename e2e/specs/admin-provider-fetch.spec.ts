/**
 * Admin 模型提供商：Ollama 一键获取模型（真实后端 + 本地 Ollama）
 *
 * 覆盖 07-08 主路径：选预设 → 填地址/Key → 拉取模型列表（不落库，避免污染环境）
 *
 * 前置：Admin :1421 + Nest :3100 + Ollama :11434
 *
 * 运行：
 *   pnpm test:e2e:admin
 *   或单独：
 *   pnpm exec playwright test --config e2e/playwright.config.ts e2e/specs/admin-provider-fetch.spec.ts
 */
import { expect, test } from '@playwright/test'
import { loginAsAdmin } from '../fixtures/admin-auth'
import { AdminPage } from '../pages/AdminPage'

const ADMIN_URL = process.env.ADMIN_SERVER_URL || 'http://localhost:1421'
const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'

test.use({ baseURL: ADMIN_URL })

test.describe.configure({ mode: 'serial' })

test.describe('Admin Provider 获取模型（真实 Ollama）', () => {
  test('选 Ollama 预设后可一键获取模型列表', async ({ page }) => {
    test.setTimeout(120_000)

    // 前置：Ollama 可达
    const tags = await page.request.get(`${OLLAMA_BASE}/api/tags`, { failOnStatusCode: false })
    test.skip(!tags.ok(), `Ollama 不可用 ${OLLAMA_BASE} status=${tags.status()}`)

    const admin = new AdminPage(page)
    await loginAsAdmin(page)
    await admin.gotoModelProviders()

    await admin.openCreateProviderModal()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('预设提供商')).toBeVisible()

    // 等预设选项加载：打开下拉后应出现 Ollama
    const presetSelect = dialog.locator('.ant-form-item').filter({ hasText: '预设提供商' }).locator('.ant-select')
    await presetSelect.click()
    const ollamaOpt = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option').filter({
      hasText: /Ollama/i,
    })
    await expect(ollamaOpt.first()).toBeVisible({ timeout: 15_000 })
    await ollamaOpt.first().click()

    // 选中后 baseUrl 应含 11434，并露出「一键获取」（aria-live 选项文案可能 hidden）
    const baseInput = dialog.getByPlaceholder('https://api.example.com/v1')
    await expect(baseInput).toHaveValue(/11434/, { timeout: 10_000 })
    await dialog.getByPlaceholder('sk-...').fill(process.env.OLLAMA_API_KEY || 'ollama')

    const fetchBtn = dialog.getByRole('button', { name: '一键获取模型列表' })
    await expect(fetchBtn).toBeVisible({ timeout: 10_000 })
    await expect(fetchBtn).toBeEnabled()

    const resPromise = page.waitForResponse(
      (r) => r.url().includes('/fetch-models') && r.request().method() === 'POST',
      { timeout: 60_000 },
    )
    // 表单重渲染可能导致按钮短暂 detached，force + 重试
    await fetchBtn.click({ force: true })
    const res = await resPromise
    expect(res.ok(), `fetch-models HTTP ${res.status()} ${await res.text().catch(() => '')}`).toBeTruthy()

    const body = (await res.json()) as {
      data?: { models?: unknown[] }
      models?: unknown[]
    }
    const models = body.data?.models ?? body.models ?? []
    expect(Array.isArray(models), '响应应含 models 数组').toBeTruthy()
    expect(models.length, 'Ollama 应至少返回 1 个模型').toBeGreaterThanOrEqual(1)

    await expect(dialog.getByPlaceholder(/模型名/).first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/获取到\s*\d+\s*个新模型|获取到/).first()).toBeVisible({
      timeout: 10_000,
    })

    // 不保存，关窗
    await page.getByRole('button', { name: 'Close' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 10_000 })
  })
})
