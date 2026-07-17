/**
 * companion-builtin-admin E2E（Web，P1 / tasks 6.4）
 *
 * 验证：双 Tab、简表创建、无安全字段 UI
 *
 * 前置：Web :1420 + Nest :3100
 *
 * 运行：
 *   WEB_SERVER_URL=http://localhost:1420 pnpm exec playwright test --config e2e/playwright.config.ts e2e/specs/companion-builtin-web.spec.ts
 */
import { expect, test } from '@playwright/test'
import { loginAsWebUser } from '../fixtures/web-auth'
import { CompanionPage } from '../pages/CompanionPage'

test.describe.configure({ mode: 'serial' })

test.describe('AI 伴侣双轨列表与简表（Web）', () => {
  test('双 Tab + 简表无安全字段 + 创建进入我的', async ({ page }) => {
    test.setTimeout(120_000)

    const companion = new CompanionPage(page)
    const name = `pw-builtin-web-${Date.now()}`

    await loginAsWebUser(page)
    await page.goto('/companions', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/companions/, { timeout: 15_000 })

    // 默认官方推荐 Tab
    await expect(page.getByRole('tab', { name: /官方推荐/ })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('tab', { name: /我的伴侣/ })).toBeVisible()

    // 官方 Tab 无「新建伴侣」
    await page.getByRole('tab', { name: /官方推荐/ }).click()
    await expect(page.getByRole('button', { name: /新建伴侣/ })).toHaveCount(0)

    // 空态或列表均可；官方空态有引导文案（勿用 getByText(/我的伴侣/)：会匹配 Tab+空态+按钮）
    const emptyOfficial = page.getByText(/暂无官方推荐|平台尚未发布内置伴侣/)
    if (await emptyOfficial.first().isVisible().catch(() => false)) {
      await expect(page.getByRole('tab', { name: /我的伴侣/ })).toBeVisible()
    }

    // 我的 Tab + 简表（先腾出创建名额，避免本地库已满 10）
    await companion.openFromSidebar()
    await companion.ensureUserCompanionQuota(1)
    await companion.createButton.first().click()
    await expect(page).toHaveURL(/\/companions\/new/, { timeout: 10_000 })
    await expect(page.getByRole('heading', { name: '新建伴侣' })).toBeVisible()

    // 简表字段存在
    await expect(page.locator('#name')).toBeVisible()
    await expect(page.locator('#description')).toBeVisible()
    await expect(page.locator('#personality')).toBeVisible()
    await expect(page.locator('#openingMessage')).toBeVisible()

    // 无安全/扩展创作者字段
    await expect(page.getByLabel(/边界设定|行为边界/)).toHaveCount(0)
    await expect(page.getByLabel(/安全提示词|guardrails/i)).toHaveCount(0)
    await expect(page.getByText(/defaultPrompt|系统提示词预览|提示词预览/)).toHaveCount(0)
    await expect(page.locator('#boundaries')).toHaveCount(0)
    await expect(page.locator('#guardrailsPrompt')).toHaveCount(0)
    await expect(page.locator('#headline')).toHaveCount(0)
    await expect(page.locator('#tone')).toHaveCount(0)
    await expect(page.locator('#backgroundStory')).toHaveCount(0)

    // 返回列表后用 POM 完整创建（避免重复填表）
    await page.goto('/companions', { waitUntil: 'domcontentloaded' })
    await companion.openFromSidebar()
    await companion.createCompanion({
      name,
      description: 'E2E 简表角色说明',
      personality: '温和、耐心',
      openingMessage: '你好，我是简表测试伴侣。',
    })

    // 创建成功后回到微信式工作台，右侧打开聊天
    await expect(page).toHaveURL(/\/companions\/?$/, { timeout: 15_000 })
    await expect(page.getByTestId('companions-workspace')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('companion-chat-panel')).toBeVisible({ timeout: 20_000 })

    // 左侧「我的」列表应能看到该联系人
    await companion.selectTab('mine')
    await expect(
      page.locator('[data-testid^="companion-contact-"]').filter({ hasText: name }).first(),
    ).toBeVisible({ timeout: 15_000 })
  })
})
