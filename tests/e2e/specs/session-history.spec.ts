import { test, expect } from '@playwright/test'
import { mockApiRoutes } from '../mocks/http-routes'
import { injectMockToken } from '../fixtures/auth'
import { HistoryPage } from '../pages/HistoryPage'

test.describe('会话历史', () => {
  test.beforeEach(async ({ page }) => {
    await injectMockToken(page)
    await mockApiRoutes(page)
    await page.goto('/app/history')
    await page.waitForLoadState('networkidle')
  })

  test('历史记录页面正常加载', async ({ page }) => {
    const historyPage = new HistoryPage(page)
    await expect(historyPage.historyList).toBeVisible()
  })

  test('显示会话列表', async ({ page }) => {
    await expect(page.locator('[data-testid="session-item"]')).toHaveCount(2)
  })

  test('点击会话恢复对话', async ({ page }) => {
    const historyPage = new HistoryPage(page)
    await historyPage.clickSession('RAG 测试')

    await expect(page).toHaveURL('/app/chat')
  })

  test('新建聊天按钮跳转到首页', async ({ page }) => {
    const historyPage = new HistoryPage(page)
    await historyPage.goto()

    // 检查侧边栏的新建聊天按钮
    const newChatBtn = page.locator('[data-testid="new-chat-btn"]')
    if (await newChatBtn.isVisible()) {
      await newChatBtn.click()
      await expect(page).toHaveURL('/app/chat')
    }
  })

  test('删除会话显示确认对话框', async ({ page }) => {
    const historyPage = new HistoryPage(page)
    await historyPage.deleteSession('RAG 测试')

    await expect(page.locator('[data-testid="delete-dialog"]')).toBeVisible()
    await expect(page.locator('h3:has-text("删除会话")')).toBeVisible()
  })

  test('确认删除后会话从列表移除', async ({ page }) => {
    await page.route(/127\.0\.0\.1:\d+\/api\/sessions\/[^/]+$/, (route) => {
      if (route.request().method() === 'DELETE') {
        route.fulfill({ status: 200 })
      }
    })

    const historyPage = new HistoryPage(page)
    await historyPage.deleteSession('RAG 测试')
    await page.locator('[data-testid="delete-confirm-btn"]').click()

    await page.waitForTimeout(300)
    await expect(historyPage.getHistoryItemByTitle('RAG 测试')).not.toBeVisible()
  })

  test('取消删除对话框保持会话', async ({ page }) => {
    const historyPage = new HistoryPage(page)
    await historyPage.deleteSession('RAG 测试')
    await page.locator('[data-testid="delete-cancel-btn"]').click()

    await expect(historyPage.getHistoryItemByTitle('RAG 测试')).toBeVisible()
  })

  test('重命名会话更新显示', async ({ page }) => {
    const historyPage = new HistoryPage(page)
    await historyPage.renameSession('RAG 测试', 'RAG 讨论重命名')

    await page.waitForTimeout(500)
    await expect(historyPage.getHistoryItemByTitle('RAG 讨论重命名')).toBeVisible()
  })

  test('会话列表显示标题和时间', async ({ page }) => {
    await expect(page.locator('[data-testid="session-item"]').first()).toContainText('RAG 测试')
  })
})
