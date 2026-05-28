import { test, expect } from '@playwright/test'
import { mockApiRoutes } from '../mocks/http-routes'
import { injectMockToken } from '../fixtures/auth'
import { KnowledgeBasePage } from '../pages/KnowledgeBasePage'

test.describe('知识库管理', () => {
  test.beforeEach(async ({ page }) => {
    await injectMockToken(page)
    await mockApiRoutes(page)
    await page.goto('/app/knowledge-base')
    await page.waitForLoadState('networkidle')
  })

  test('知识库列表页面正常加载', async ({ page }) => {
    await expect(page.locator('[data-testid="kb-list"]')).toBeVisible()
    await expect(page.locator('[data-testid="create-kb-btn"]')).toBeVisible()
  })

  test('创建新知识库', async ({ page }) => {
    const kbPage = new KnowledgeBasePage(page)
    const newKbName = `测试知识库_${Date.now()}`

    await kbPage.createKnowledgeBase(newKbName)

    await expect(page.locator('[data-testid="kb-item"]').filter({ hasText: newKbName })).toBeVisible()
  })

  test('点击知识库进入详情', async ({ page }) => {
    await page.route('**/api/knowledge-bases', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          json: [
            { id: 'kb-1', name: '技术文档', icon: 'mdi-database', isPinned: false, sortOrder: 0 },
          ],
        })
      }
    })

    await page.locator('[data-testid="kb-item"]').filter({ hasText: '技术文档' }).click()

    await expect(page.locator('[data-testid="file-explorer"]')).toBeVisible()
  })

  test('右键知识库弹出上下文菜单', async ({ page }) => {
    await page.route('**/api/knowledge-bases', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          json: [
            { id: 'kb-1', name: '技术文档', icon: 'mdi-database', isPinned: false, sortOrder: 0 },
          ],
        })
      }
    })

    const kbPage = new KnowledgeBasePage(page)
    await kbPage.openKbContextMenu('技术文档')

    await expect(kbPage.contextMenu).toBeVisible()
    await expect(kbPage.contextMenu.locator('text=置顶')).toBeVisible()
    await expect(kbPage.contextMenu.locator('text=编辑')).toBeVisible()
    await expect(kbPage.contextMenu.locator('text=删除')).toBeVisible()
  })

  test('点击外部关闭右键菜单', async ({ page }) => {
    await page.route('**/api/knowledge-bases', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          json: [
            { id: 'kb-1', name: '技术文档', icon: 'mdi-database', isPinned: false, sortOrder: 0 },
          ],
        })
      }
    })

    const kbPage = new KnowledgeBasePage(page)
    await kbPage.openKbContextMenu('技术文档')
    await expect(kbPage.contextMenu).toBeVisible()

    await page.locator('body').click({ position: { x: 10, y: 10 } })
    await expect(kbPage.contextMenu).not.toBeVisible()
  })

  test('删除知识库显示确认对话框', async ({ page }) => {
    await page.route('**/api/knowledge-bases', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          json: [
            { id: 'kb-1', name: '技术文档', icon: 'mdi-database', isPinned: false, sortOrder: 0 },
          ],
        })
      }
    })

    const kbPage = new KnowledgeBasePage(page)
    await kbPage.openKbContextMenu('技术文档')
    await kbPage.clickContextMenuItem('删除')

    await expect(page.locator('[data-testid="delete-dialog"]')).toBeVisible()
    await expect(page.locator('[data-testid="delete-confirm-btn"]')).toBeVisible()
    await expect(page.locator('[data-testid="delete-cancel-btn"]')).toBeVisible()
  })

  test('确认删除后知识库从列表移除', async ({ page }) => {
    await page.route('**/api/knowledge-bases', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          json: [
            { id: 'kb-1', name: '技术文档', icon: 'mdi-database', isPinned: false, sortOrder: 0 },
          ],
        })
      }
    })

    await page.route(/127\.0\.0\.1:\d+\/api\/knowledge-bases\/kb-1$/, (route) => {
      if (route.request().method() === 'DELETE') {
        route.fulfill({ status: 204 })
      }
    })

    const kbPage = new KnowledgeBasePage(page)
    await kbPage.openKbContextMenu('技术文档')
    await kbPage.clickContextMenuItem('删除')
    await page.locator('[data-testid="delete-confirm-btn"]').click()

    await expect(page.locator('[data-testid="kb-item"]').filter({ hasText: '技术文档' })).not.toBeVisible()
  })

  test('取消删除对话框保持知识库', async ({ page }) => {
    await page.route('**/api/knowledge-bases', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          json: [
            { id: 'kb-1', name: '技术文档', icon: 'mdi-database', isPinned: false, sortOrder: 0 },
          ],
        })
      }
    })

    const kbPage = new KnowledgeBasePage(page)
    await kbPage.openKbContextMenu('技术文档')
    await kbPage.clickContextMenuItem('删除')
    await page.locator('button:has-text("取消")').click()

    await expect(page.locator('[data-testid="kb-item"]').filter({ hasText: '技术文档' })).toBeVisible()
  })
})
