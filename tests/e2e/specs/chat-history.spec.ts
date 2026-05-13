import { test, expect } from '@playwright/test'
import { injectMockTauri } from '../mocks/tauri-ipc'
import { mockHttpRoutes } from '../mocks/http-routes'
import { HistoryPage } from '../pages/HistoryPage'

test.describe('历史记录页面交互', () => {
  test.beforeEach(async ({ page }) => {
    await injectMockTauri(page)
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

    let dialogMessage = ''
    page.on('dialog', async (dialog) => {
      dialogMessage = dialog.message()
      await dialog.accept()
    })

    await historyPage.deleteSession('RAG 使用讨论')
    await expect.poll(() => dialogMessage).toContain('删除')
  })

  test('rename session updates display', async ({ page }) => {
    const historyPage = new HistoryPage(page)
    await page.locator('button:has(.i-mdi-history)').click()
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
