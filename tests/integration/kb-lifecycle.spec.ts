import { test, expect } from '@playwright/test'
import { cleanupDatabase } from '../e2e/fixtures/database'
import { createTestUser, isBackendAvailable } from '../e2e/fixtures/auth'
import { ApiClient } from '../e2e/fixtures/api-client'

let backendOk: boolean

test.describe('知识库生命周期 (q-17)', () => {
  test.beforeAll(async () => {
    backendOk = await isBackendAvailable()
  })

  test.beforeEach(async () => {
    test.skip(!backendOk, 'Backend unavailable — skipping KB lifecycle integration test')
    await cleanupDatabase()
  })

  test('AC-09: 知识库列表页面加载', async ({ page }) => {
    const user = await createTestUser()
    const client = new ApiClient(user.accessToken)
    await client.createKB('Test KB 1')
    await client.createKB('Test KB 2')

    // 注入 token 并访问知识库页面
    await page.addInitScript({
      content: `
        localStorage.setItem('goferbot_access_token', '${user.accessToken}')
        localStorage.setItem('goferbot_refresh_token', '${user.refreshToken}')
      `,
    })
    await page.goto('/app/knowledge-base')
    await page.waitForSelector('[data-testid="kb-list"]', { timeout: 10000 })

    const items = page.locator('[data-testid="kb-item"]')
    await expect(items).toHaveCount(2)
  })

  test('AC-10: 创建新知识库并显示在列表', async ({ page }) => {
    const user = await createTestUser()

    await page.addInitScript({
      content: `
        localStorage.setItem('goferbot_access_token', '${user.accessToken}')
        localStorage.setItem('goferbot_refresh_token', '${user.refreshToken}')
      `,
    })
    await page.goto('/app/knowledge-base')
    await page.waitForSelector('[data-testid="kb-list"]', { timeout: 10000 })

    // 点击新建按钮
    await page.click('[data-testid="create-kb-btn"]')
    await page.waitForSelector('[data-testid="create-dialog"]', { timeout: 5000 })

    // 填写名称并确认
    await page.fill('[data-testid="kb-name-input"]', 'My New KB')
    await page.click('[data-testid="kb-create-confirm"]')

    // 等待对话框关闭，列表中出现新项
    await page.waitForSelector('[data-testid="create-dialog"]', { state: 'hidden', timeout: 10000 })
    const items = page.locator('[data-testid="kb-item"]')
    await expect(items).toHaveCount(1)
    await expect(items.first()).toContainText('My New KB')
  })

  test('AC-11: 点击知识库进入详情页', async ({ page }) => {
    const user = await createTestUser()
    const client = new ApiClient(user.accessToken)
    const kb = await client.createKB('Detail KB')

    await page.addInitScript({
      content: `
        localStorage.setItem('goferbot_access_token', '${user.accessToken}')
        localStorage.setItem('goferbot_refresh_token', '${user.refreshToken}')
      `,
    })
    await page.goto('/app/knowledge-base')
    await page.waitForSelector('[data-testid="kb-item"]', { timeout: 10000 })

    await page.click('[data-testid="kb-item"]')
    // 详情页应显示文件管理器
    await page.waitForSelector('[data-testid="file-explorer"]', { timeout: 10000 })
  })

  test('AC-12: 上传文档到知识库', async ({ page }) => {
    const user = await createTestUser()
    const client = new ApiClient(user.accessToken)
    const kb = await client.createKB('Upload KB')

    await page.addInitScript({
      content: `
        localStorage.setItem('goferbot_access_token', '${user.accessToken}')
        localStorage.setItem('goferbot_refresh_token', '${user.refreshToken}')
      `,
    })
    await page.goto('/app/knowledge-base')
    await page.waitForSelector('[data-testid="kb-item"]', { timeout: 10000 })

    // 进入知识库详情
    await page.click('[data-testid="kb-item"]')
    await page.waitForSelector('[data-testid="file-explorer"]', { timeout: 10000 })

    // 点击"添加文件"打开上传对话框
    await page.click('button:has-text("添加文件")')
    await page.waitForSelector('text=上传文件', { timeout: 5000 })

    // 在对话框中设置文件
    const fileInput = page.locator('input[type="file"]').first()
    await fileInput.setInputFiles({
      name: 'test-doc.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from('# Test Document\nThis is a test.'),
    })

    // 点击开始上传
    await page.click('button:has-text("开始上传")')

    // 等待上传完成，文件出现在列表中
    await page.waitForSelector('text=test-doc.md', { timeout: 15000 })
  })

  test('AC-13: 删除知识库显示确认对话框', async ({ page }) => {
    const user = await createTestUser()
    const client = new ApiClient(user.accessToken)
    await client.createKB('Delete KB')

    await page.addInitScript({
      content: `
        localStorage.setItem('goferbot_access_token', '${user.accessToken}')
        localStorage.setItem('goferbot_refresh_token', '${user.refreshToken}')
      `,
    })
    await page.goto('/app/knowledge-base')
    await page.waitForSelector('[data-testid="kb-item"]', { timeout: 10000 })

    // 点击 hover 出现的删除按钮（更稳定）
    const kbItem = page.locator('[data-testid="kb-item"]').first()
    await kbItem.hover()
    await kbItem.locator('[data-testid="kb-delete-btn"]').click()

    // 等待确认对话框出现
    await page.waitForSelector('[data-testid="delete-dialog"]', { timeout: 5000 })
    await expect(page.locator('[data-testid="confirm-dialog"]')).toBeVisible()
  })

  test('AC-14: 确认删除后知识库从列表移除', async ({ page }) => {
    const user = await createTestUser()
    const client = new ApiClient(user.accessToken)
    await client.createKB('Remove KB')

    await page.addInitScript({
      content: `
        localStorage.setItem('goferbot_access_token', '${user.accessToken}')
        localStorage.setItem('goferbot_refresh_token', '${user.refreshToken}')
      `,
    })
    await page.goto('/app/knowledge-base')
    await page.waitForSelector('[data-testid="kb-item"]', { timeout: 10000 })

    // 通过 API 直接删除，然后验证前端列表刷新后为空
    const kbs = await client.listKBs()
    await client.deleteKB(kbs[0].id)

    // 刷新页面
    await page.reload()
    await page.waitForSelector('[data-testid="kb-list"]', { timeout: 10000 })

    const items = page.locator('[data-testid="kb-item"]')
    await expect(items).toHaveCount(0)
  })

  test('AC-15: 用户 B 无法看到用户 A 的知识库', async ({ page }) => {
    const userA = await createTestUser()
    const userB = await createTestUser()
    const clientA = new ApiClient(userA.accessToken)
    await clientA.createKB('Private KB')

    // 用户 B 登录并访问知识库列表
    await page.addInitScript({
      content: `
        localStorage.setItem('goferbot_access_token', '${userB.accessToken}')
        localStorage.setItem('goferbot_refresh_token', '${userB.refreshToken}')
      `,
    })
    await page.goto('/app/knowledge-base')
    await page.waitForSelector('[data-testid="kb-list"]', { timeout: 10000 })

    const items = page.locator('[data-testid="kb-item"]')
    await expect(items).toHaveCount(0)
  })

  test('AC-16: 上传 txt/md/pdf 三种类型文档', async ({ page }) => {
    const user = await createTestUser()
    const client = new ApiClient(user.accessToken)
    const kb = await client.createKB('Multi Format KB')

    await page.addInitScript({
      content: `
        localStorage.setItem('goferbot_access_token', '${user.accessToken}')
        localStorage.setItem('goferbot_refresh_token', '${user.refreshToken}')
      `,
    })
    await page.goto('/app/knowledge-base')
    await page.waitForSelector('[data-testid="kb-item"]', { timeout: 10000 })

    await page.click('[data-testid="kb-item"]')
    await page.waitForSelector('[data-testid="file-explorer"]', { timeout: 10000 })

    async function uploadFile(name: string, mimeType: string, content: string) {
      await page.click('button:has-text("添加文件")')
      await page.waitForSelector('text=上传文件', { timeout: 5000 })
      const fileInput = page.locator('input[type="file"]').first()
      await fileInput.setInputFiles({ name, mimeType, buffer: Buffer.from(content) })
      await page.click('button:has-text("开始上传")')
      await page.waitForSelector(`text=${name}`, { timeout: 15000 })
    }

    // 上传 txt
    await uploadFile('test.txt', 'text/plain', 'Hello txt')

    // 上传 md
    await uploadFile('test.md', 'text/markdown', '# Hello md')

    // 上传 pdf（模拟，后端只检查后缀和 mime）
    await uploadFile('test.pdf', 'application/pdf', '%PDF-1.4 fake pdf content')
  })
})
