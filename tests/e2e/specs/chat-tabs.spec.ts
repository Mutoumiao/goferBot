import { test, expect } from '@playwright/test'
import { mockApiRoutes } from '../mocks/http-routes'
import { injectMockToken } from '../fixtures/auth'

test.describe('聊天标签栏 (f-04)', () => {
  test.beforeEach(async ({ page }) => {
    await injectMockToken(page)
    await mockApiRoutes(page)
    await page.goto('/app/chat')
    await page.waitForLoadState('load')
    await page.waitForSelector('[data-testid="tab-bar"]', { timeout: 10000 })
  })

  test('TC-F04-001: 初始状态仅显示首页标签', async ({ page }) => {
    const tabs = page.locator('[data-testid^="chat-tab-"]')
    await expect(tabs).toHaveCount(1)
    await expect(tabs.first()).toContainText('首页')
  })

  test('TC-F04-002: 新建标签创建新会话', async ({ page }) => {
    const newTabBtn = page.locator('[data-testid="new-chat-btn"]')
    await newTabBtn.click()

    const tabs = page.locator('[data-testid^="chat-tab-"]')
    await expect(tabs).toHaveCount(2)
    const newTab = tabs.last()
    await expect(newTab).toContainText('新会话')
  })

  test('TC-F04-003: 切换标签显示对应会话内容', async ({ page }) => {
    await page.locator('[data-testid="new-chat-btn"]').click()
    await page.locator('[data-testid="new-chat-btn"]').click()

    const tabs = page.locator('[data-testid^="chat-tab-"]')
    await expect(tabs).toHaveCount(3)

    await tabs.first().click()
    await expect(tabs.first()).toHaveClass(/active/)
  })

  test('TC-F04-007: 首页标签不可关闭', async ({ page }) => {
    const homeTab = page.locator('[data-testid^="chat-tab-"]').first()
    await homeTab.hover()

    const closeBtn = page.locator('[data-testid="tab-close-btn"]')
    await expect(closeBtn).toHaveCount(0)
  })

  test('TC-F04-008: 重命名标签', async ({ page }) => {
    await page.locator('[data-testid="new-chat-btn"]').click()

    const tabs = page.locator('[data-testid^="chat-tab-"]')
    const newTab = tabs.last()

    // dblclick 处理器在 tab 标题 span 上，直接双击整个 tab button 内的文本区域
    await newTab.dblclick({ position: { x: 20, y: 10 } })

    const input = page.locator('[data-testid^="tab-edit-input-"]')
    await input.waitFor({ timeout: 5000 })
    await input.fill('我的新会话')
    await input.press('Enter')

    await expect(newTab).toContainText('我的新会话')
  })
})
