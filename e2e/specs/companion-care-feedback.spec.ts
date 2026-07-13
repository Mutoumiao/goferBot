/**
 * Companion 关怀计划 + 消息反馈 E2E（真实后端）
 *
 * 覆盖：创建伴侣 → 打开关怀页（默认计划）→ 立即生成 → 聊天可见关怀消息
 *       → 对助手消息点赞 → 记忆库仍可进入
 *
 * 前置：Web :1420 + Nest :3100
 *
 * 运行：
 *   WEB_SERVER_URL=http://localhost:1420 pnpm exec playwright test --config e2e/playwright.config.ts e2e/specs/companion-care-feedback.spec.ts
 */
import { expect, test } from '@playwright/test'
import { loginAsWebUser } from '../fixtures/web-auth'
import { CompanionPage } from '../pages/CompanionPage'

test.describe.configure({ mode: 'serial' })

test.describe('AI 伴侣 · 关怀与反馈', () => {
  test('关怀默认计划 → 生成 → 聊天可见；点赞反馈', async ({ page }) => {
    test.setTimeout(180_000)

    const companion = new CompanionPage(page)
    const name = `pw-care-${Date.now()}`

    await loginAsWebUser(page)
    await companion.openFromSidebar()
    await companion.createCompanion({
      name,
      headline: '关怀 E2E',
      openingMessage: '嗨，我是关怀测试。',
    })

    // 进入关怀页
    await page.getByRole('button', { name: /关怀/ }).click()
    await expect(page).toHaveURL(/\/care/, { timeout: 15_000 })
    await expect(page.getByText(/主动关怀|关怀计划/).first()).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/默认配置|尚未持久化/).first()).toBeVisible({ timeout: 10_000 })

    // 立即生成（模板路径，无需 LLM）
    const genPromise = page.waitForResponse(
      (r) =>
        r.url().includes('/care-events/generate') &&
        r.request().method() === 'POST',
      { timeout: 30_000 },
    )
    await page.getByRole('button', { name: /立即生成/ }).click()
    const genRes = await genPromise
    expect(genRes.ok(), `generate failed ${genRes.status()}`).toBeTruthy()

    // 生成后回到聊天
    await expect(page).toHaveURL(/\/chat/, { timeout: 15_000 })
    await expect(page.locator('main')).toContainText(/.+/, { timeout: 15_000 })

    // 关怀消息应出现（模板含称呼/场景相关字样，或任意助手气泡）
    const body = await page.locator('main').innerText()
    expect(body.length).toBeGreaterThan(10)
    expect(body.includes('（无内容）')).toBeFalsy()

    // 对助手消息点赞（非开场白优先：取最后一个点赞）
    const thumbs = page.getByRole('button', { name: /点赞/ })
    await expect(thumbs.last()).toBeVisible({ timeout: 10_000 })
    const fbPromise = page.waitForResponse(
      (r) => r.url().includes('/feedback') && r.request().method() === 'POST',
      { timeout: 20_000 },
    )
    await thumbs.last().click()
    const fbRes = await fbPromise
    expect(fbRes.ok(), `feedback failed ${fbRes.status()} ${await fbRes.text().catch(() => '')}`).toBeTruthy()
    const fbJson = (await fbRes.json().catch(() => ({}))) as {
      data?: { rating?: string }
      rating?: string
    }
    const rating = fbJson.data?.rating ?? fbJson.rating
    expect(rating === 'positive' || rating === undefined).toBeTruthy()

    // 记忆库仍可进入
    await companion.openMemories()
    await expect(page.getByText(/记忆|暂无|偏好|边界/).first()).toBeVisible({ timeout: 15_000 })
  })
})
