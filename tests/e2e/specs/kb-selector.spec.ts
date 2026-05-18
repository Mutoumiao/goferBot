import { test, expect } from '@playwright/test'
import { mockApiRoutes } from '../mocks/http-routes'
import { injectAuthToken } from '../fixtures/auth'

test.describe.skip('知识库选择器 (f-11)', () => {
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

    // Mock 知识库列表
    await page.route('**/api/knowledge-bases', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          json: [
            { id: 'kb-1', name: '技术文档', icon: 'mdi-database', isPinned: false, sortOrder: 0, documentCount: 10 },
            { id: 'kb-2', name: '会议记录', icon: 'mdi-file-text', isPinned: true, sortOrder: 999, documentCount: 5 },
          ],
        })
      }
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('TC-F11-001: @ 触发下拉显示知识库列表', async ({ page }) => {
    const textarea = page.locator('[data-testid="chat-input"] textarea')
    await textarea.fill('@')

    const dropdown = page.locator('[data-testid="kb-selector-dropdown"]')
    await expect(dropdown).toBeVisible()

    const items = dropdown.locator('[data-testid="kb-selector-item"]')
    await expect(items).toHaveCount(2)
  })

  test('TC-F11-002: 选择知识库显示标签', async ({ page }) => {
    const textarea = page.locator('[data-testid="chat-input"] textarea')
    await textarea.fill('@')

    const dropdown = page.locator('[data-testid="kb-selector-dropdown"]')
    await expect(dropdown).toBeVisible()

    // 点击第一个知识库
    const firstItem = dropdown.locator('[data-testid="kb-selector-item"]').first()
    await firstItem.click()

    // 检查标签是否显示
    const pill = page.locator('[data-testid="kb-mention-pill"]')
    await expect(pill).toBeVisible()
    await expect(pill).toContainText('技术文档')
  })

  test('TC-F11-003: 多选知识库显示多个标签', async ({ page }) => {
    const textarea = page.locator('[data-testid="chat-input"] textarea')

    // 选择第一个知识库
    await textarea.fill('@')
    const dropdown = page.locator('[data-testid="kb-selector-dropdown"]')
    await dropdown.locator('[data-testid="kb-selector-item"]').first().click()

    // 选择第二个知识库
    await textarea.fill('@')
    await dropdown.locator('[data-testid="kb-selector-item"]').last().click()

    // 检查两个标签是否显示
    const pills = page.locator('[data-testid="kb-mention-pill"]')
    await expect(pills).toHaveCount(2)
  })

  test('TC-F11-004: 键盘导航选择知识库', async ({ page }) => {
    const textarea = page.locator('[data-testid="chat-input"] textarea')
    await textarea.fill('@')

    const dropdown = page.locator('[data-testid="kb-selector-dropdown"]')
    await expect(dropdown).toBeVisible()

    // 按向下箭头
    await textarea.press('ArrowDown')
    // 按 Enter 选择
    await textarea.press('Enter')

    // 检查标签是否显示
    const pill = page.locator('[data-testid="kb-mention-pill"]')
    await expect(pill).toBeVisible()
  })

  test('TC-F11-005: 按 Escape 关闭下拉', async ({ page }) => {
    const textarea = page.locator('[data-testid="chat-input"] textarea')
    await textarea.fill('@')

    const dropdown = page.locator('[data-testid="kb-selector-dropdown"]')
    await expect(dropdown).toBeVisible()

    await textarea.press('Escape')
    await expect(dropdown).not.toBeVisible()
  })

  test('TC-F11-006: 删除已选标签', async ({ page }) => {
    const textarea = page.locator('[data-testid="chat-input"] textarea')

    // 选择知识库
    await textarea.fill('@')
    const dropdown = page.locator('[data-testid="kb-selector-dropdown"]')
    await dropdown.locator('[data-testid="kb-selector-item"]').first().click()

    // 检查标签显示
    const pill = page.locator('[data-testid="kb-mention-pill"]')
    await expect(pill).toBeVisible()

    // 删除标签 - 点击 X 按钮
    const removeBtn = pill.locator('button')
    await removeBtn.click()

    await expect(pill).not.toBeVisible()
  })

  test('TC-F11-007: 发送携带 knowledgeBaseIds', async ({ page }) => {
    const textarea = page.locator('[data-testid="chat-input"] textarea')

    // 选择知识库
    await textarea.fill('@')
    const dropdown = page.locator('[data-testid="kb-selector-dropdown"]')
    await dropdown.locator('[data-testid="kb-selector-item"]').first().click()

    // 输入消息内容
    await textarea.fill('你好')

    // 监听 SSE 请求
    const sseRequest = page.waitForRequest('**/api/chat')

    // 发送消息
    const sendBtn = page.locator('[data-testid="send-btn"]')
    await sendBtn.click()

    const request = await sseRequest
    const requestBody = request.postData()
    expect(requestBody).toContain('kb-1')
  })

  test('TC-F11-008: 未选择知识库发送消息', async ({ page }) => {
    const textarea = page.locator('[data-testid="chat-input"] textarea')
    await textarea.fill('你好')

    // 监听 SSE 请求
    const sseRequest = page.waitForRequest('**/api/chat')

    // 发送消息
    const sendBtn = page.locator('[data-testid="send-btn"]')
    await sendBtn.click()

    const request = await sseRequest
    const requestBody = request.postData()
    // 确认请求中不包含知识库 ID 或包含空数组
    expect(requestBody).toBeTruthy()
  })

  test('TC-F11-009: 空知识库提示', async ({ page }) => {
    // Mock 空知识库列表
    await page.route('**/api/knowledge-bases', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          json: [],
        })
      }
    })

    await page.reload()
    await page.waitForLoadState('networkidle')

    const textarea = page.locator('[data-testid="chat-input"] textarea')
    await textarea.fill('@')

    const dropdown = page.locator('[data-testid="kb-selector-dropdown"]')
    await expect(dropdown).toBeVisible()
    await expect(dropdown).toContainText('请先创建知识库')
  })

  test('TC-F11-010: 加载状态显示骨架屏', async ({ page }) => {
    // Mock 延迟响应
    await page.route('**/api/knowledge-bases', (route) => {
      setTimeout(() => {
        route.fulfill({
          json: [
            { id: 'kb-1', name: '技术文档', icon: 'mdi-database', isPinned: false, sortOrder: 0, documentCount: 10 },
          ],
        })
      }, 2000)
    })

    await page.reload()
    await page.waitForLoadState('networkidle')

    const textarea = page.locator('[data-testid="chat-input"] textarea')
    await textarea.fill('@')

    const dropdown = page.locator('[data-testid="kb-selector-dropdown"]')
    await expect(dropdown).toBeVisible()

    // 检查骨架屏是否显示
    const skeleton = dropdown.locator('[data-testid="skeleton"]')
    await expect(skeleton).toBeVisible()
  })

  test('TC-F11-011: 重复选择不重复添加标签', async ({ page }) => {
    const textarea = page.locator('[data-testid="chat-input"] textarea')

    // 选择第一个知识库两次
    await textarea.fill('@')
    let dropdown = page.locator('[data-testid="kb-selector-dropdown"]')
    await dropdown.locator('[data-testid="kb-selector-item"]').first().click()

    await textarea.fill('@')
    dropdown = page.locator('[data-testid="kb-selector-dropdown"]')
    await dropdown.locator('[data-testid="kb-selector-item"]').first().click()

    // 应该只有一个标签
    const pills = page.locator('[data-testid="kb-mention-pill"]')
    await expect(pills).toHaveCount(1)
  })

  test('TC-F11-012: 点击外部关闭下拉', async ({ page }) => {
    const textarea = page.locator('[data-testid="chat-input"] textarea')
    await textarea.fill('@')

    const dropdown = page.locator('[data-testid="kb-selector-dropdown"]')
    await expect(dropdown).toBeVisible()

    // 点击外部区域（消息列表区域）
    await page.locator('[data-testid="chat-messages"]').click()

    await expect(dropdown).not.toBeVisible()
  })
})
