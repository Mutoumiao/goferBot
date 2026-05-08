import { test, expect } from '@playwright/test'
import { injectMockTauri } from '../mocks/tauri-ipc'
import { mockKnowledgeBases, mockFiles } from '../fixtures/knowledge-bases'
import { KnowledgeBasePage } from '../pages/KnowledgeBasePage'

test.describe('知识库右键菜单', () => {
  test.beforeEach(async ({ page }) => {
    await injectMockTauri(page, {
      async get_sidecar_port() {
        return 11451
      },
    })

    await page.route('http://127.0.0.1:*/knowledge-bases', (route) => {
      route.fulfill({ json: mockKnowledgeBases })
    })

    await page.route('http://127.0.0.1:*/knowledge-bases/*/files*', (route) => {
      route.fulfill({ json: { path: '', items: mockFiles } })
    })

    await page.route('http://127.0.0.1:*/knowledge-bases/*/index-status', (route) => {
      route.fulfill({ json: { totalFiles: 10, indexedFiles: 7, pendingFiles: 0 } })
    })

    const kbPage = new KnowledgeBasePage(page)
    await kbPage.goto()
  })

  test('右键知识库弹出菜单', async ({ page }) => {
    const kbPage = new KnowledgeBasePage(page)
    await kbPage.openKbContextMenu('技术文档')
    await expect(kbPage.contextMenu).toBeVisible()
    await expect(kbPage.contextMenu.locator('text=置顶')).toBeVisible()
    await expect(kbPage.contextMenu.locator('text=修改资料')).toBeVisible()
    await expect(kbPage.contextMenu.locator('text=移入回收站')).toBeVisible()
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
})
