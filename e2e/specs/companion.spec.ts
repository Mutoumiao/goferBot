/**
 * AI 伴侣主流程 E2E（真实后端）
 *
 * 验证：登录 → 新建伴侣 → 进入聊天 → 发送消息 → 收到助手回复 → 打开记忆库
 *
 * 前置：Web :1420 + Nest :3100 + 已配置 Companion LLM Provider
 *
 * 运行：
 *   WEB_SERVER_URL=http://localhost:1420 pnpm exec playwright test --config e2e/playwright.config.ts e2e/specs/companion.spec.ts
 */
import { expect, test } from '@playwright/test'
import { loginAsWebUser } from '../fixtures/web-auth'
import { CompanionPage } from '../pages/CompanionPage'

test.describe.configure({ mode: 'serial' })

test.describe('AI 伴侣（真实后端）', () => {
  test('创建伴侣 → 聊天流式回复 → 记忆库页', async ({ page }) => {
    test.setTimeout(240_000)

    const companion = new CompanionPage(page)
    const name = `pw-companion-${Date.now()}`
    const opening = '你好，我是 Playwright 测试伴侣。'

    await loginAsWebUser(page)
    await companion.openFromSidebar()

    await companion.createCompanion({
      name,
      headline: 'E2E 伴侣',
      openingMessage: opening,
    })

    await companion.openChatByName(name)

    // 开场白或空态均可
    await expect(
      page.getByText(opening).or(page.getByText('开始新对话')).first(),
    ).toBeVisible({ timeout: 20_000 })

    // 1) 快捷提示发送（直接 onSubmit）
    await companion.sendQuickPrompt('今天想聊点什么？')
    await companion.waitForAssistantReply(180_000)
    await expect(page.getByText('今天想聊点什么？').first()).toBeVisible()

    let bodyText = await page.locator('main').innerText()
    expect(bodyText.includes('（无内容）'), '助手不应静默空回复').toBeFalsy()
    expect(bodyText.includes('（回复中断')).toBeFalsy()

    // 记忆库页可打开
    await companion.openMemories()
    await expect(page.getByText(/记忆|暂无|偏好|边界/).first()).toBeVisible({ timeout: 15_000 })
  })
})
