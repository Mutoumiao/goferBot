import { test, expect } from '@playwright/test'
import { injectMockShell } from '../mocks/shell-memory'
import { mockKnowledgeBases, mockFiles } from '../fixtures/knowledge-bases'
import { KnowledgeBasePage } from '../pages/KnowledgeBasePage'

test.describe('知识库右键菜单', () => {
  test.beforeEach(async ({ page }) => {
    await injectMockShell(page)

    await page.route('http://127.0.0.1:*/knowledge-bases', (route) => {
      route.fulfill({ json: mockKnowledgeBases })
    })

    await page.route('http://127.0.0.1:*/knowledge-bases/*/files*', (route) => {
      route.fulfill({ json: { path: '', items: mockFiles } })
    })

    await page.route('http://127.0.0.1:*/knowledge-bases/*/index-status', (route) => {
      route.fulfill({ json: { totalFiles: 10, indexedFiles: 7, pendingFiles: 0 } })
    })

    await page.goto('/')
    await page.waitForTimeout(800)
    await page.locator('button:has(.i-mdi-database-outline)').first().click()
    await expect(page.locator('[data-testid="kb-list"]')).toBeVisible()
  })

  test('右键知识库弹出菜单', async ({ page }) => {
    const kbPage = new KnowledgeBasePage(page)
    await kbPage.openKbContextMenu('技术文档')
    await expect(kbPage.contextMenu).toBeVisible()
    await expect(kbPage.contextMenu.locator('text=置顶')).toBeVisible()
    await expect(kbPage.contextMenu.locator('text=编辑')).toBeVisible()
    await expect(kbPage.contextMenu.locator('text=删除')).toBeVisible()
  })

  test('点击外部关闭右键菜单', async ({ page }) => {
    const kbPage = new KnowledgeBasePage(page)
    await kbPage.openKbContextMenu('技术文档')
    await expect(kbPage.contextMenu).toBeVisible()

    await page.locator('body').click({ position: { x: 10, y: 10 } })
    await expect(kbPage.contextMenu).not.toBeVisible()
  })

  test('新建知识库后出现在列表', async ({ page }) => {
    let createdName = ''

    await page.route('http://127.0.0.1:*/knowledge-bases', (route) => {
      if (route.request().method() === 'POST') {
        createdName = '新项目'
        const newKb = {
          id: 'kb-new',
          name: '新项目',
          icon: 'mdi-database',
          is_pinned: 0,
          sort_order: 2,
          path: 'docs/新项目',
          created_at: new Date().toISOString(),
          deleted_at: null,
        }
        route.fulfill({ status: 201, json: newKb })
      } else {
        route.fulfill({ json: [...mockKnowledgeBases, { id: 'kb-new', name: '新项目', icon: 'mdi-database', is_pinned: 0, sort_order: 2, path: 'docs/新项目', created_at: new Date().toISOString(), deleted_at: null }] })
      }
    })

    const kbPage = new KnowledgeBasePage(page)
    await kbPage.createKnowledgeBase('新项目')
    await expect(page.locator('[data-testid="kb-item"]').filter({ hasText: '新项目' })).toBeVisible()
  })

  test('E2E-01: 右键置顶知识库', async ({ page }) => {
    await page.route(/127\.0\.0\.1:\d+\/knowledge-bases\/[^/]+$/, (route) => {
      if (route.request().method() === 'PATCH') {
        const url = route.request().url()
        const id = url.split('/').pop()
        const kb = mockKnowledgeBases.find((k) => k.id === id)
        if (kb) {
          route.fulfill({ json: { ...kb, sort_order: 999999 } })
        } else {
          route.fulfill({ status: 404 })
        }
      } else {
        route.continue()
      }
    })

    const kbPage = new KnowledgeBasePage(page)
    await kbPage.openKbContextMenu('会议记录')
    await kbPage.clickContextMenuItem('置顶')

    // After pinning, "会议记录" should appear first due to sort_order sorting
    const firstItem = page.locator('[data-testid="kb-item"]').first()
    await expect(firstItem).toContainText('会议记录')
  })

  test('E2E-02: 右键修改知识库资料', async ({ page }) => {
    const kbPage = new KnowledgeBasePage(page)
    await kbPage.openKbContextMenu('技术文档')
    await kbPage.clickContextMenuItem('编辑')

    // Verify edit dialog appears with title and current name
    await expect(page.locator('text=修改资料').first()).toBeVisible()
    await expect(page.locator('h3:has-text("修改资料") + div input[type="text"]')).toHaveValue('技术文档')
  })

  test('E2E-03: 右键移入回收站', async ({ page }) => {
    page.on('dialog', (dialog) => dialog.accept())

    await page.route(/127\.0\.0\.1:\d+\/knowledge-bases\/[^/]+$/, (route) => {
      if (route.request().method() === 'DELETE') {
        route.fulfill({ status: 204 })
      } else {
        route.continue()
      }
    })

    const kbPage = new KnowledgeBasePage(page)
    await kbPage.openKbContextMenu('会议记录')
    await kbPage.clickContextMenuItem('删除')

    // Verify the KB disappears from the list
    await expect(page.locator('[data-testid="kb-item"]').filter({ hasText: '会议记录' })).not.toBeVisible()
  })

  test('E2E-04: 弹窗文案验证', async ({ page }) => {
    let dialogMessage = ''
    page.on('dialog', (dialog) => {
      dialogMessage = dialog.message()
      dialog.dismiss()
    })

    const kbPage = new KnowledgeBasePage(page)
    await kbPage.openKbContextMenu('技术文档')
    await kbPage.clickContextMenuItem('删除')

    // Wait for the dialog to fire
    await page.waitForTimeout(200)
    expect(dialogMessage).toContain('技术文档')
    expect(dialogMessage).toContain('回收站')
  })

  test('E2E-05: 文件区域右键新建文件夹', async ({ page }) => {
    const newFolderName = '未命名文件夹_1234'

    await page.route(/127\.0\.0\.1:\d+\/knowledge-bases\/[^/]+\/folders/, (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({ json: { name: newFolderName } })
      } else {
        route.continue()
      }
    })

    await page.route('http://127.0.0.1:*/knowledge-bases/*/files*', (route) => {
      route.fulfill({
        json: {
          path: '',
          items: [...mockFiles, { name: newFolderName, type: 'directory', size: 0, updatedAt: '2026-05-08T10:00:00Z' }],
        },
      })
    })

    // Select a KB to see the file explorer
    await page.locator('[data-testid="kb-item"]').filter({ hasText: '技术文档' }).click()
    const fileExplorer = page.locator('[data-testid="file-explorer"]')
    await expect(fileExplorer).toBeVisible()

    // Right-click on blank area (header row) in file explorer
    await fileExplorer.locator('text=名称').first().click({ button: 'right' })

    // Click "新建文件夹"
    const contextMenu = page.locator('[data-testid="context-menu"]')
    await contextMenu.locator('text=新建文件夹').click()

    // Verify inline rename input appears for the new folder
    const renameInput = fileExplorer.locator('input.border-accent-500')
    await expect(renameInput).toHaveValue('未命名文件夹_1234')
  })

  test('E2E-06: 文件右键重命名', async ({ page }) => {
    // Select a KB to see the file explorer
    await page.locator('[data-testid="kb-item"]').filter({ hasText: '技术文档' }).click()
    const fileExplorer = page.locator('[data-testid="file-explorer"]')
    await expect(fileExplorer).toBeVisible()

    // Right-click on file row
    const fileRow = fileExplorer.locator('text=intro.md').first()
    await fileRow.click({ button: 'right' })

    // Click "重命名"
    const contextMenu = page.locator('[data-testid="context-menu"]')
    await contextMenu.locator('text=重命名').click()

    // Verify inline rename input appears with base name (no extension)
    const renameInput = fileExplorer.locator('input.border-accent-500')
    await expect(renameInput).toHaveValue('intro')
  })

  test('E2E-07: 文件右键移动', async ({ page }) => {
    // Select a KB to see the file explorer
    await page.locator('[data-testid="kb-item"]').filter({ hasText: '技术文档' }).click()
    const fileExplorer = page.locator('[data-testid="file-explorer"]')
    await expect(fileExplorer).toBeVisible()

    // Right-click on file row
    const fileRow = fileExplorer.locator('text=intro.md').first()
    await fileRow.click({ button: 'right' })

    // Click "移动到..."
    const contextMenu = page.locator('[data-testid="context-menu"]')
    await contextMenu.locator('text=移动到...').click()

    // Verify move dialog appears
    await expect(page.locator('text=移动到').first()).toBeVisible()
  })

  test('E2E-08: 文件右键复制', async ({ page }) => {
    // Select a KB to see the file explorer
    await page.locator('[data-testid="kb-item"]').filter({ hasText: '技术文档' }).click()
    const fileExplorer = page.locator('[data-testid="file-explorer"]')
    await expect(fileExplorer).toBeVisible()

    // Right-click on file row
    const fileRow = fileExplorer.locator('text=intro.md').first()
    await fileRow.click({ button: 'right' })

    // Click "复制到..."
    const contextMenu = page.locator('[data-testid="context-menu"]')
    await contextMenu.locator('text=复制到...').click()

    // Verify copy dialog appears
    await expect(page.locator('text=复制到').first()).toBeVisible()
  })

  test('E2E-09: 文件冲突处理', async ({ page }) => {
    await page.route(/127\.0\.0\.1:\d+\/knowledge-bases\/copy/, (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({ status: 409, json: { error: '目标位置已存在同名文件' } })
      } else {
        route.continue()
      }
    })

    // Select a KB to see the file explorer
    await page.locator('[data-testid="kb-item"]').filter({ hasText: '技术文档' }).click()
    const fileExplorer = page.locator('[data-testid="file-explorer"]')
    await expect(fileExplorer).toBeVisible()

    // Right-click on file row
    const fileRow = fileExplorer.locator('text=intro.md').first()
    await fileRow.click({ button: 'right' })

    // Click "复制到..."
    const contextMenu = page.locator('[data-testid="context-menu"]')
    await contextMenu.locator('text=复制到...').click()

    // Click confirm in copy dialog
    await page.locator('text=复制至此').click()

    // Verify copy dialog closes (app handles error silently via store.error, no toast shown)
    await expect(page.locator('text=复制到').first()).not.toBeVisible()
  })

  test('E2E-10: 文件永久删除', async ({ page }) => {
    page.on('dialog', (dialog) => dialog.accept())

    let fileDeleted = false

    // Handle DELETE requests to file paths (regex with path segment after /files/)
    await page.route(/127\.0\.0\.1:\d+\/knowledge-bases\/[^/]+\/files\/.+/, (route) => {
      if (route.request().method() === 'DELETE') {
        fileDeleted = true
        route.fulfill({ status: 204 })
      } else {
        route.continue()
      }
    })

    // Handle GET requests to /files?path= (regex with query string)
    await page.route(/127\.0\.0\.1:\d+\/knowledge-bases\/[^/]+\/files\?/, (route) => {
      const items = fileDeleted ? mockFiles.filter((f) => f.name !== 'intro.md') : mockFiles
      route.fulfill({ json: { path: '', items } })
    })

    // Select a KB to see the file explorer
    await page.locator('[data-testid="kb-item"]').filter({ hasText: '技术文档' }).click()
    const fileExplorer = page.locator('[data-testid="file-explorer"]')
    await expect(fileExplorer).toBeVisible()

    // Right-click on file row
    const fileRow = fileExplorer.locator('text=intro.md').first()
    await fileRow.click({ button: 'right' })

    // Click "永久删除"
    const contextMenu = page.locator('[data-testid="context-menu"]')
    await contextMenu.locator('text=永久删除').click()

    // Verify file disappears
    await expect(fileExplorer.locator('text=intro.md')).not.toBeVisible()
  })

  test('E2E-11: 回收站入口可见', async ({ page }) => {
    // The recycle bin button is in the sidebar with trash can icon
    await expect(page.locator('.i-mdi-trash-can-outline').first()).toBeVisible()
  })

  test('E2E-12: 回收站恢复同名重命名', async ({ page }) => {
    page.on('dialog', (dialog) => dialog.accept())

    const deletedKb = {
      id: 'kb-deleted',
      name: '技术文档',
      icon: 'mdi-books',
      is_pinned: 0,
      sort_order: 0,
      path: 'docs/技术文档',
      created_at: '2026-05-01T08:00:00Z',
      deleted_at: '2026-05-10T08:00:00Z',
    }

    await page.route('http://127.0.0.1:*/knowledge-bases/deleted', (route) => {
      route.fulfill({ json: [deletedKb] })
    })

    await page.route(/127\.0\.0\.1:\d+\/knowledge-bases\/[^/]+\/restore/, (route) => {
      if (route.request().method() === 'POST') {
        // Return with renamed name to simulate backend conflict resolution
        route.fulfill({ json: { ...deletedKb, name: '技术文档 (1)', deleted_at: null } })
      } else {
        route.continue()
      }
    })

    await page.route('http://127.0.0.1:*/knowledge-bases', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          json: [
            ...mockKnowledgeBases,
            { ...deletedKb, name: '技术文档 (1)', deleted_at: null },
          ],
        })
      } else {
        route.continue()
      }
    })

    // Navigate to recycle bin via sidebar trash icon
    await page.locator('.i-mdi-trash-can-outline').first().click()

    // Verify recycle bin page is shown
    await expect(page.locator('text=回收站').first()).toBeVisible()
    await expect(page.locator('text=删除的对话和知识文件会暂时保留，过期后自动清理。')).toBeVisible()

    // Click restore
    await page.getByRole('button', { name: '恢复' }).click()

    // Switch back to knowledge base tab
    await page.locator('button:has(.i-mdi-database-outline)').first().click()
    await expect(page.locator('[data-testid="kb-list"]')).toBeVisible()

    // Verify restored KB appears with the renamed name
    await expect(page.locator('[data-testid="kb-item"]').filter({ hasText: '技术文档 (1)' })).toBeVisible()
  })
})
