/**
 * companion-builtin-admin E2E（Admin + Web 官方可见，P1 / tasks 6.5）
 *
 * 验证：Admin 创建内置 → 发布 → Web 官方 Tab 可见
 *
 * 前置：Admin :1421 + Web :1420 + Nest :3100
 *
 * 运行：
 *   ADMIN_SERVER_URL=http://localhost:1421 WEB_SERVER_URL=http://localhost:1420 \
 *   pnpm exec playwright test --config e2e/playwright.config.ts e2e/specs/companion-builtin-admin.spec.ts
 */
import { expect, test } from '@playwright/test'
import { loginAsAdmin } from '../fixtures/admin-auth'
import { loginAsWebUser } from '../fixtures/web-auth'
import { AdminPage } from '../pages/AdminPage'

const ADMIN_URL = process.env.ADMIN_SERVER_URL || 'http://localhost:1421'
const WEB_URL = process.env.WEB_SERVER_URL || 'http://localhost:1420'

test.describe.configure({ mode: 'serial' })

test.describe('内置伴侣 Admin → Web 官方可见', () => {
  test('创建并发布后，Web 官方推荐可见', async ({ browser }) => {
    test.setTimeout(180_000)

    const name = `pw-sys-${Date.now()}`
    const adminContext = await browser.newContext({ baseURL: ADMIN_URL })
    const adminPage = await adminContext.newPage()
    const admin = new AdminPage(adminPage)

    try {
      await loginAsAdmin(adminPage)
      await admin.gotoCompanions()

      await adminPage.getByRole('button', { name: /新建/ }).click()
      const dialog = adminPage.getByRole('dialog')
      await expect(dialog.getByText(/新建内置伴侣/)).toBeVisible({ timeout: 10_000 })

      // antd Form：按 label 定位
      await dialog.getByLabel('名称').fill(name)
      await dialog.getByLabel('一句话设定').fill('E2E 官方角色')
      await dialog.getByLabel('角色说明').fill('平台内置 E2E 伴侣')
      await dialog.getByLabel('性格与互动').fill('沉稳、可靠')
      await dialog.getByLabel('边界设定').fill('不讨论违法内容')
      await dialog.getByLabel('安全提示词').fill('保持安全边界')
      await dialog.getByLabel('开场白').fill('你好，我是官方 E2E 伴侣。')

      // 直接创建为已发布
      const statusItem = dialog.locator('.ant-form-item').filter({ hasText: /^状态/ })
      await statusItem.locator('.ant-select').click()
      await adminPage
        .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')
        .filter({ hasText: '已发布' })
        .click()

      const createPromise = adminPage.waitForResponse(
        (r) =>
          r.url().includes('/admin/companions') &&
          r.request().method() === 'POST' &&
          !r.url().includes('/avatar'),
        { timeout: 20_000 },
      )
      await dialog.getByRole('button', { name: /确\s*定|OK|保存/ }).click()
      const createRes = await createPromise
      expect(
        createRes.ok(),
        `创建内置失败: ${createRes.status()} ${await createRes.text().catch(() => '')}`,
      ).toBeTruthy()

      await expect(dialog).toBeHidden({ timeout: 15_000 })
      await expect(adminPage.getByText(name).first()).toBeVisible({ timeout: 15_000 })
      // 表格行内状态 Tag
      await expect(
        adminPage.locator('tr').filter({ hasText: name }).getByText('已发布'),
      ).toBeVisible({ timeout: 10_000 })
    } finally {
      await adminContext.close()
    }

    // Web 官方 Tab
    const webContext = await browser.newContext({ baseURL: WEB_URL })
    const webPage = await webContext.newPage()
    try {
      await loginAsWebUser(webPage)
      await webPage.goto('/companions', { waitUntil: 'domcontentloaded' })
      await webPage.getByRole('tab', { name: /官方推荐/ }).click()
      const heading = webPage.getByRole('heading', { name, exact: true })
      await expect(heading).toBeVisible({ timeout: 20_000 })
      // 官方卡可开始聊天；用 heading 锚定最近卡片根，避免外层 div 吞进多张卡
      const card = heading.locator(
        'xpath=ancestor::div[.//button[contains(normalize-space(.), "开始聊天")]][1]',
      )
      await expect(card.getByRole('button', { name: /开始聊天/ }).first()).toBeVisible()
      // 系统卡不应出现编辑入口（用户自定义卡上的编辑菜单）
      await expect(card.getByRole('menuitem', { name: /编辑/ })).toHaveCount(0)
    } finally {
      await webContext.close()
    }
  })
})
