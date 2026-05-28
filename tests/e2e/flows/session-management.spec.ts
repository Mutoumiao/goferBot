import { test, expect } from '@playwright/test'
import { injectMockToken } from '../../e2e/fixtures/auth'
import { mockApiRoutes } from '../../e2e/mocks/http-routes'

test.describe('会话管理 (q-18)', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => {
      console.log(`[BROWSER ${msg.type()}]`, msg.text())
    })
    await injectMockToken(page)
    await mockApiRoutes(page)
    await page.goto('/app/chat')
    await page.waitForLoadState('load')
    await page.waitForSelector('[data-testid="tab-bar"]', { timeout: 10000 })
  })

  test('AC-09: 初始状态仅显示首页标签', async ({ page }) => {
    const tabs = page.locator('[data-testid^="chat-tab-"]')
    await expect(tabs).toHaveCount(1)
    await expect(tabs.first()).toContainText('首页')

    // 首页不可关闭：无关闭按钮
    const closeBtn = tabs.first().locator('[data-testid="tab-close-btn"]')
    await expect(closeBtn).toHaveCount(0)
  })

  test('AC-10: 新建标签创建新会话', async ({ page }) => {
    await page.locator('[data-testid="new-chat-btn"]').click()

    const tabs = page.locator('[data-testid^="chat-tab-"]')
    await expect(tabs).toHaveCount(2)
  })

  test('AC-11: 切换标签显示对应会话内容', async ({ page }) => {
    // 新建两个标签
    await page.locator('[data-testid="new-chat-btn"]').click()
    await page.locator('[data-testid="new-chat-btn"]').click()

    const tabs = page.locator('[data-testid^="chat-tab-"]')
    await expect(tabs).toHaveCount(3)

    // 点击第一个标签（首页）
    await tabs.nth(0).click()
    await expect(tabs.nth(0)).toHaveAttribute('data-active', 'true')

    // 点击第二个标签
    await tabs.nth(1).click()
    await expect(tabs.nth(1)).toHaveAttribute('data-active', 'true')
  })

  test('AC-12: 关闭非首页标签', async ({ page }) => {
    await page.locator('[data-testid="new-chat-btn"]').click()
    await page.locator('[data-testid="new-chat-btn"]').click()

    const tabs = page.locator('[data-testid^="chat-tab-"]')
    await expect(tabs).toHaveCount(3)

    // 关闭最后一个标签（先 hover 显示关闭按钮，然后点击关闭按钮的父 Button）
    const lastTab = tabs.last()
    await lastTab.hover()
    // 使用 force: true 点击可能不可见的关闭按钮
    await lastTab.locator('[data-testid="tab-close-btn"]').click({ force: true })

    await expect(tabs).toHaveCount(2)
  })

  test('AC-13: 首页标签不可关闭', async ({ page }) => {
    const homeTab = page.locator('[data-testid^="chat-tab-"]').first()
    await homeTab.hover()

    const closeBtn = homeTab.locator('[data-testid="tab-close-btn"]')
    await expect(closeBtn).toHaveCount(0)
  })

  test('AC-14: 重命名标签更新显示', async ({ page }) => {
    await page.locator('[data-testid="new-chat-btn"]').click()

    const tabs = page.locator('[data-testid^="chat-tab-"]')
    const newTab = tabs.last()

    // 双击进入编辑模式
    await newTab.dblclick()

    const input = page.locator('[data-testid^="tab-edit-input-"]').first()
    await input.waitFor({ timeout: 5000 })
    await input.fill('测试会话')
    await input.press('Enter')

    await expect(tabs.last()).toContainText('测试会话')
  })

  test('AC-15: 历史记录页面显示会话列表', async ({ page }) => {
    await page.goto('/app/history')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('[data-testid="session-list"]')).toBeVisible()
    await expect(page.locator('[data-testid="session-item"]')).toHaveCount(2)
  })

  test('AC-16: 点击历史会话恢复对话', async ({ page }) => {
    await page.goto('/app/history')
    await page.waitForLoadState('networkidle')

    const firstItem = page.locator('[data-testid="session-item"]').first()
    // 点击打开按钮以恢复会话
    await firstItem.locator('[data-testid="session-open-btn"]').click({ force: true })

    // 等待路由切换到 /app/chat
    await page.waitForURL(/\/app\/chat/, { timeout: 10000 })
    await page.waitForSelector('[data-testid="chat-message-list"]', { timeout: 10000 })
    await expect(page.locator('[data-testid="chat-message-list"]')).toBeVisible()
  })

  test('AC-17: 删除历史会话显示确认对话框', async ({ page }) => {
    await page.goto('/app/history')
    await page.waitForLoadState('networkidle')

    const firstItem = page.locator('[data-testid="session-item"]').first()
    await firstItem.locator('[data-testid="session-menu-btn"]').click()
    await firstItem.locator('[data-testid="session-delete-btn"]').click()

    await expect(page.locator('[data-testid="delete-dialog"]')).toBeVisible()
  })

  test('AC-18: 重命名历史会话更新显示', async ({ page }) => {
    await page.goto('/app/history')
    await page.waitForLoadState('networkidle')

    const firstItem = page.locator('[data-testid="session-item"]').first()

    await firstItem.locator('[data-testid="session-menu-btn"]').click()
    await firstItem.locator('[data-testid="session-rename-btn"]').click()

    const input = page.locator('[data-testid="rename-input"]')
    await input.fill('重命名后的会话')
    await input.press('Enter')

    await page.waitForTimeout(500)
    await expect(page.locator('[data-testid="session-item"]').filter({ hasText: '重命名后的会话' })).toBeVisible()
  })

  test('AC-19: 空历史状态显示提示', async ({ page }) => {
    // 局部覆盖 sessions 返回空列表
    await page.route('**/api/sessions', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({ json: { data: { items: [] } } })
      }
    })

    await page.goto('/app/history')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('text=暂无对话历史')).toBeVisible()
  })
})
