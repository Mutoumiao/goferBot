import { test, expect } from '@playwright/test'
import { mockApiRoutes } from '../mocks/http-routes'
import { injectAuthToken } from '../fixtures/auth'

test.describe.skip('聊天标签栏 (f-04)', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuthToken(page)
    await mockApiRoutes(page)

    await page.route('**/auth/me', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          json: { id: 'user-1', email: 'test@example.com', name: 'Test User' },
        })
      }
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('TC-F04-001: 初始状态仅显示首页标签', async ({ page }) => {
    const tabs = page.locator('[data-testid^="chat-tab-"]')
    await expect(tabs).toHaveCount(1)
    await expect(tabs.first()).toContainText('首页')
    await expect(tabs.first()).toHaveClass(/active/)
  })

  test('TC-F04-002: 新建标签创建新会话', async ({ page }) => {
    const newTabBtn = page.locator('[data-testid="new-chat-btn"]')
    await newTabBtn.click()

    const tabs = page.locator('[data-testid^="chat-tab-"]')
    await expect(tabs).toHaveCount(2)
    const newTab = tabs.last()
    await expect(newTab).toContainText('新会话')
    await expect(newTab).toHaveClass(/active/)
  })

  test('TC-F04-003: 切换标签显示对应会话内容', async ({ page }) => {
    // 新建两个标签
    await page.locator('[data-testid="new-chat-btn"]').click()
    await page.locator('[data-testid="new-chat-btn"]').click()

    const tabs = page.locator('[data-testid^="chat-tab-"]')
    await expect(tabs).toHaveCount(3)

    // 切换到第一个标签（首页）
    await tabs.first().click()
    await expect(tabs.first()).toHaveClass(/active/)
  })

  test('TC-F04-004: 关闭非首页标签', async ({ page }) => {
    // 新建标签
    await page.locator('[data-testid="new-chat-btn"]').click()

    let tabs = page.locator('[data-testid^="chat-tab-"]')
    await expect(tabs).toHaveCount(2)

    // 关闭新标签
    const newTab = tabs.last()
    await newTab.hover()
    const closeBtn = page.locator('[data-testid="tab-close-btn"]')
    await closeBtn.click()

    tabs = page.locator('[data-testid^="chat-tab-"]')
    await expect(tabs).toHaveCount(1)
    await expect(tabs.first()).toContainText('首页')
  })

  test('TC-F04-005: 关闭当前标签自动切换到相邻标签', async ({ page }) => {
    // 新建两个标签
    await page.locator('[data-testid="new-chat-btn"]').click()
    await page.locator('[data-testid="new-chat-btn"]').click()

    let tabs = page.locator('[data-testid^="chat-tab-"]')
    await expect(tabs).toHaveCount(3)

    // 关闭中间的标签（当前激活的）
    const middleTab = tabs.nth(1)
    await middleTab.hover()
    const closeBtn = page.locator('[data-testid="tab-close-btn"]').first()
    await closeBtn.click()

    tabs = page.locator('[data-testid^="chat-tab-"]')
    await expect(tabs).toHaveCount(2)
    // 应该切换到首页（第一个标签）
    await expect(tabs.first()).toHaveClass(/active/)
  })

  test('TC-F04-006: 关闭最后一个可关闭标签', async ({ page }) => {
    // 新建一个标签
    await page.locator('[data-testid="new-chat-btn"]').click()

    let tabs = page.locator('[data-testid^="chat-tab-"]')
    await expect(tabs).toHaveCount(2)

    // 关闭可关闭标签（第二个标签）
    const secondTab = tabs.nth(1)
    await secondTab.hover()
    const closeBtn = page.locator('[data-testid="tab-close-btn"]')
    await closeBtn.click()

    tabs = page.locator('[data-testid^="chat-tab-"]')
    await expect(tabs).toHaveCount(1)
    await expect(tabs.first()).toContainText('首页')
    await expect(tabs.first()).toHaveClass(/active/)
  })

  test('TC-F04-007: 首页标签不可关闭', async ({ page }) => {
    const homeTab = page.locator('[data-testid^="chat-tab-"]').first()
    await homeTab.hover()

    // 首页标签不应该显示关闭按钮
    const closeBtn = page.locator('[data-testid="tab-close-btn"]')
    await expect(closeBtn).toHaveCount(0)
  })

  test('TC-F04-008: 重命名标签', async ({ page }) => {
    // 新建标签
    await page.locator('[data-testid="new-chat-btn"]').click()

    const tabs = page.locator('[data-testid^="chat-tab-"]')
    const newTab = tabs.last()

    // 双击标签进入编辑状态
    await newTab.dblclick()

    // 输入新标题
    const input = page.locator('input[type="text"]')
    await input.fill('我的新会话')
    await input.press('Enter')

    // 验证标题更新
    await expect(newTab).toContainText('我的新会话')
  })

  test('TC-F04-009: 取消重命名', async ({ page }) => {
    // 新建标签
    await page.locator('[data-testid="new-chat-btn"]').click()

    const tabs = page.locator('[data-testid^="chat-tab-"]')
    const newTab = tabs.last()

    // 双击标签进入编辑状态
    await newTab.dblclick()

    // 输入新标题后按 Escape
    const input = page.locator('input[type="text"]')
    await input.fill('临时标题')
    await input.press('Escape')

    // 验证标题恢复为原值
    await expect(newTab).toContainText('新会话')
  })

  test('TC-F04-010: 新建会话失败（网络异常）', async ({ page }) => {
    // Mock API 错误
    await page.route('**/sessions', (route) => {
      if (route.request().method() === 'POST') {
        route.abort('failed')
      }
    })

    const newTabBtn = page.locator('[data-testid="new-chat-btn"]')
    await newTabBtn.click()

    // 检查是否显示错误提示
    const toast = page.locator('[data-testid="toast-error"]')
    await expect(toast).toBeVisible()
  })

  test('TC-F04-011: 标签横向滚动', async ({ page }) => {
    // 新建多个标签直到超出宽度
    for (let i = 0; i < 10; i++) {
      await page.locator('[data-testid="new-chat-btn"]').click()
    }

    const tabs = page.locator('[data-testid^="chat-tab-"]')
    await expect(tabs).toHaveCount(11)

    // 检查标签栏是否可滚动
    const tabBar = page.locator('[data-testid="tab-bar"]')
    await expect(tabBar).toHaveClass(/overflow-x-auto/)
  })

  test('TC-F04-012: 首页发送消息创建新会话', async ({ page }) => {
    // 在首页标签下输入消息并发送
    const textarea = page.locator('[data-testid="chat-input"] textarea')
    await textarea.fill('测试消息')

    const sendBtn = page.locator('[data-testid="send-btn"]')
    await sendBtn.click()

    // 等待会话创建
    await page.waitForTimeout(1000)

    const tabs = page.locator('[data-testid^="chat-tab-"]')
    // 应该创建了新会话标签
    await expect(tabs).toHaveCount(2)
  })
})
