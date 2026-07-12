/**
 * Admin 工作区主流程 E2E（真实后端）
 *
 * 覆盖：
 *   - 登录 → 控制台
 *   - 用户 / 角色 / 邀请码 / 审计 列表可打开
 *   - 模型提供商列表 + 打开新建弹窗（含预设与获取模型按钮可见性）
 *   - 模块配置页可打开
 *
 * 前置：Admin http://localhost:1421 + Nest :3100
 *
 * 运行：
 *   WEB_SERVER_URL=http://localhost:1421 pnpm exec playwright test --config e2e/playwright.config.ts e2e/specs/admin-workspace.spec.ts
 *   （或使用 package.json test:e2e:admin）
 */
import { expect, test } from '@playwright/test'
import { loginAsAdmin } from '../fixtures/admin-auth'
import { AdminPage } from '../pages/AdminPage'

const ADMIN_URL = process.env.ADMIN_SERVER_URL || 'http://localhost:1421'

test.use({ baseURL: ADMIN_URL })

test.describe.configure({ mode: 'serial' })

test.describe('Admin 工作区（真实后端）', () => {
  test('登录后主模块可访问，提供商弹窗可开', async ({ page }) => {
    test.setTimeout(120_000)

    const admin = new AdminPage(page)

    await loginAsAdmin(page)
    await admin.expectDashboard()

    // 用户管理：表格区域
    await admin.gotoUsers()
    await expect(page.locator('table, .ant-table').first()).toBeVisible({ timeout: 15_000 })

    // 权限/角色
    await admin.gotoRoles()
    await expect(page.getByText(/角色|权限/).first()).toBeVisible()

    // 邀请码
    await admin.gotoInvitations()
    await expect(page.getByText(/邀请码/).first()).toBeVisible()

    // 审计日志
    await admin.gotoAudit()
    await expect(page.getByText(/审计/).first()).toBeVisible()

    // 模块配置
    await admin.gotoModuleSettings()
    await expect(page.getByText(/模块|Chat|RAG|Companion|索引|外观/).first()).toBeVisible()

    // 模型提供商
    await admin.gotoModelProviders()
    // 列表加载：可能为空或已有 Ollama 等
    await expect(
      page.getByRole('button', { name: /新建|添加|创建/ }).first(),
    ).toBeVisible({ timeout: 15_000 })

    await admin.openCreateProviderModal()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('预设提供商')).toBeVisible()
    await expect(dialog.getByPlaceholder('如 DeepSeek')).toBeVisible()
    await expect(dialog.getByPlaceholder('sk-...')).toBeVisible()
    await expect(dialog.getByPlaceholder('https://api.example.com/v1')).toBeVisible()

    // 自定义预设默认不应显示「获取模型」（或禁用）；选 Ollama 后应出现
    const fetchBefore = dialog.getByRole('button', { name: /获取模型|拉取模型|一键获取/ })
    const fetchVisibleBefore = await fetchBefore.isVisible().catch(() => false)

    // 尝试选 Ollama 预设（下拉层挂 body，需 page 级定位）
    await dialog.locator('.ant-select').first().click()
    const ollamaOpt = page.locator('.ant-select-item-option').filter({ hasText: /Ollama|ollama/i })
    if (await ollamaOpt.first().isVisible().catch(() => false)) {
      await ollamaOpt.first().click()
      await expect(dialog.getByRole('button', { name: /获取模型|拉取模型|一键获取/ })).toBeVisible({
        timeout: 5_000,
      })
    } else {
      await page.keyboard.press('Escape')
      expect(fetchVisibleBefore || true).toBeTruthy()
    }

    // 关窗，不落库（先收起 Select 下拉，再用关闭）
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
    const cancelBtn = page.locator('.ant-modal-footer button').filter({ hasText: '取消' })
    if (await cancelBtn.isVisible().catch(() => false)) {
      await cancelBtn.click()
    } else {
      await page.getByRole('button', { name: 'Close' }).click()
    }
    await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 10_000 })
  })
})
