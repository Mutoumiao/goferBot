/**
 * Companion 二级弹层契约 E2E（真实后端）
 *
 * 覆盖 web-l1-cache-l2-dialogs：
 * - 新建弹层：URL 保持 /companions
 * - 记忆库 / 关怀弹层：URL 不变
 * - 切一级菜单后弹层关闭
 *
 * 运行：
 *   WEB_SERVER_URL=http://localhost:1420 pnpm exec playwright test --config e2e/playwright.config.ts e2e/specs/companion-l2-dialogs.spec.ts
 */
import { expect, test } from '@playwright/test'
import { loginAsWebUser } from '../fixtures/web-auth'
import { CompanionPage } from '../pages/CompanionPage'

test.describe.configure({ mode: 'serial' })

test.describe('Companion 二级弹层（L2 dialogs）', () => {
  test('新建/记忆/关怀弹层不改 path；切一级关闭弹层', async ({ page }) => {
    test.setTimeout(180_000)

    const companion = new CompanionPage(page)
    const name = `pw-l2-${Date.now()}`

    await loginAsWebUser(page)
    await companion.openFromSidebar()
    await expect(page).toHaveURL(/\/companions\/?$/)

    // 打开新建弹层
    await companion.selectTab('mine')
    await companion.createButton.first().click()
    await expect(page).toHaveURL(/\/companions\/?$/)
    await expect(page.getByRole('heading', { name: '新建伴侣' })).toBeVisible({ timeout: 10_000 })
    await companion.closeTopDialog()
    await expect(page.getByRole('heading', { name: '新建伴侣' })).toHaveCount(0)

    // 完整创建并进入聊天
    await companion.createCompanion({
      name,
      headline: 'L2 dialog E2E',
      openingMessage: '你好，二级弹层测试。',
    })
    await expect(page).toHaveURL(/\/companions\/?$/)
    await expect(page.getByTestId('companion-chat-panel')).toBeVisible({ timeout: 20_000 })

    // 记忆库弹层
    await companion.openMemories()
    await expect(page).toHaveURL(/\/companions\/?$/)
    await companion.closeTopDialog()
    await expect(page.getByRole('heading', { name: /记忆库/ })).toHaveCount(0, { timeout: 10_000 })
    await expect(page.getByTestId('companion-chat-panel')).toBeVisible()

    // 关怀弹层
    await companion.openCare()
    await expect(page).toHaveURL(/\/companions\/?$/)
    await companion.closeTopDialog()
    await expect(page.getByText(/启用关怀计划/).first()).toHaveCount(0, { timeout: 10_000 })

    // 再开关怀后切一级 → closeAll
    await companion.openCare()
    await expect(page.getByText(/启用关怀计划|立即生成/).first()).toBeVisible()
    await page.getByTestId('rail-chats').click()
    await expect(page).toHaveURL(/\/chats/, { timeout: 15_000 })
    await expect(page.getByText(/启用关怀计划/).first()).toHaveCount(0, { timeout: 10_000 })
  })
})
