import { test, expect } from '@playwright/test'
import { injectMockShell } from '../mocks/shell-memory'
import { mockHttpRoutes } from '../mocks/http-routes'
import { HistoryPage } from '../pages/HistoryPage'

test.describe.configure({ mode: 'serial' })

test.describe('历史记录页面交互', () => {
  test.beforeEach(async ({ page }) => {
    await injectMockShell(page)
    await mockHttpRoutes(page)
    await page.goto('/')
  })

  test('open history page shows list', async ({ page }) => {
    const historyPage = new HistoryPage(page)
    await historyPage.goto()
    await expect(historyPage.historyList).toBeVisible()
  })

  test('history list renders session items', async ({ page }) => {
    const historyPage = new HistoryPage(page)
    await historyPage.goto()
    await expect(historyPage.historyItems).toHaveCount(2)
  })

  test('click session restores chat', async ({ page }) => {
    const historyPage = new HistoryPage(page)
    await historyPage.goto()
    await historyPage.clickSession('RAG 使用讨论')
    await expect(page.locator('[data-testid="chat-input"]')).toBeVisible()
  })

  test('delete session shows confirmation', async ({ page }) => {
    const historyPage = new HistoryPage(page)
    await historyPage.goto()

    await historyPage.deleteSession('RAG 使用讨论')

    // Verify custom confirm dialog appears
    await expect(page.locator('.fixed.inset-0.z-50')).toBeVisible()
    await expect(page.locator('h3:has-text("提示")')).toBeVisible()
    const message = page.locator('.fixed.inset-0.z-50 p')
    await expect(message).toContainText('删除')

    // Confirm the dialog
    await page.locator('button:has-text("确定")').click()
    await expect(page.locator('.fixed.inset-0.z-50')).not.toBeVisible()
  })

  test('rename session updates display', async ({ page }) => {
    const historyPage = new HistoryPage(page)
    await page.locator('button:has(.lucide-history)').click()
    await page.waitForSelector('[data-testid="history-list"]')
    await historyPage.renameSession('RAG 使用讨论', 'RAG 讨论重命名')
    await page.waitForTimeout(1000)
    await expect(historyPage.getHistoryItemByTitle('RAG 讨论重命名')).toBeVisible()
  })

  test('new chat button navigates to chat', async ({ page }) => {
    const historyPage = new HistoryPage(page)
    await historyPage.goto()
    await page.locator('[data-testid="new-chat-btn"]').click()
    await expect(page.getByText('今天想从知识库里理解什么？')).toBeVisible()
  })
})
