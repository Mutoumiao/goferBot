import { expect, type Locator, type Page } from '@playwright/test'

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3100'

export class KnowledgeBasePage {
  readonly page: Page
  readonly createKbButton: Locator
  readonly kbNameInput: Locator
  readonly createSubmitButton: Locator
  readonly uploadButton: Locator
  readonly emptyUploadButton: Locator
  readonly uploadManagerDialog: Locator
  readonly uploadDropZone: Locator
  readonly fileInput: Locator
  readonly uploadMiniPanel: Locator
  readonly uploadBadge: Locator
  readonly fileBrowser: Locator

  constructor(page: Page) {
    this.page = page
    this.createKbButton = page.getByRole('button', { name: '新建知识库' })
    this.kbNameInput = page.locator('#kb-name')
    this.createSubmitButton = page
      .getByRole('dialog')
      .getByRole('button', { name: /创建|创建中/ })
    this.uploadButton = page.getByRole('button', { name: /上传文件/ })
    this.emptyUploadButton = page
      .getByText('暂无文件')
      .locator('..')
      .getByRole('button', { name: '上传文件' })
    this.uploadManagerDialog = page.getByTestId('upload-manager-dialog')
    this.uploadDropZone = page.getByTestId('upload-drop-zone')
    this.fileInput = page.locator('[data-testid="upload-drop-zone"] input[type="file"]')
    this.uploadMiniPanel = page.getByTestId('upload-mini-panel')
    this.uploadBadge = page.getByTestId('upload-badge')
    this.fileBrowser = page.getByRole('application', { name: '文件浏览器' })
  }

  async openFromSidebar() {
    // 侧栏 icon 与 Tab 都可能有 title=知识库，限定 button 避免 strict 冲突
    const sideBtn = this.page.getByRole('button', { name: '知识库', exact: true })
    if (await sideBtn.isVisible().catch(() => false)) {
      await sideBtn.click()
    } else {
      await this.page.goto('/knowledgeBase', { waitUntil: 'domcontentloaded' })
    }
    await expect(this.page.getByRole('heading', { name: '知识库', exact: true })).toBeVisible({
      timeout: 15_000,
    })
  }

  async createKnowledgeBase(name: string, description = 'Playwright E2E'): Promise<string> {
    // 用共享 Cookie 调 Nest API 创建，避免 UI 列表刷新竞态
    const res = await this.page.request.post(`${API_BASE}/api/knowledge-bases`, {
      data: { name, description },
      failOnStatusCode: false,
      headers: { 'X-App-Context': 'web', 'Content-Type': 'application/json' },
    })
    const createText = await res.text()
    expect(res.ok(), `创建知识库 API 失败: ${res.status()} ${createText}`).toBeTruthy()
    let body: { data?: { id?: string; name?: string }; id?: string; name?: string }
    try {
      body = JSON.parse(createText) as typeof body
    } catch {
      throw new Error(`创建知识库响应非 JSON: ${createText.slice(0, 200)}`)
    }
    const kbId = body.data?.id ?? body.id
    const createdName = body.data?.name ?? body.name ?? name
    expect(kbId, `创建知识库响应缺少 id: ${createText.slice(0, 300)}`).toBeTruthy()

    // 校验列表 API 可见（默认 size=20 会漏掉第 2 页；拉满 100）
    const listRes = await this.page.request.get(
      `${API_BASE}/api/knowledge-bases?page=1&size=100`,
      {
        failOnStatusCode: false,
        headers: { 'X-App-Context': 'web' },
      },
    )
    const listText = await listRes.text()
    expect(listRes.ok(), `列表知识库失败: ${listRes.status()} ${listText.slice(0, 200)}`).toBeTruthy()
    expect(
      listText.includes(createdName) || listText.includes(String(kbId)),
      `列表未包含新建 KB。create=${createText.slice(0, 300)} list=${listText.slice(0, 400)}`,
    ).toBeTruthy()

    await this.page.goto('/knowledgeBase', { waitUntil: 'domcontentloaded' })
    await expect(this.page.getByRole('heading', { name: '知识库', exact: true })).toBeVisible({
      timeout: 15_000,
    })

    const search = this.page.getByPlaceholder('搜索知识库')
    if (await search.isVisible().catch(() => false)) {
      await search.fill(createdName)
    }

    const selectBtn = this.page.getByRole('button', { name: `选择知识库 ${createdName}` })
    await expect(selectBtn).toBeVisible({ timeout: 20_000 })
    await selectBtn.click()
    await expect(this.fileBrowser).toBeVisible({ timeout: 10_000 })
    return kbId as string
  }

  /** 内容区应干净：无常驻 DropZone / 上传任务条（弹窗关闭时） */
  async expectCleanContentArea() {
    await expect(this.uploadManagerDialog).toHaveCount(0)
    // DropZone 仅应在弹窗内；弹窗关闭时不应存在
    await expect(this.uploadDropZone).toHaveCount(0)
    await expect(this.page.getByTestId('progress-fill')).toHaveCount(0)
  }

  async openUploadManagerFromToolbar() {
    // 工具栏上传按钮 aria-label 含「上传文件」；空态也有同文案，优先工具栏 icon
    const toolbarUpload = this.fileBrowser.getByRole('button', { name: /上传文件/ }).first()
    await toolbarUpload.click()
    await expect(this.uploadManagerDialog).toBeVisible({ timeout: 10_000 })
  }

  async openUploadManagerFromEmptyState() {
    await expect(this.page.getByText('暂无文件')).toBeVisible({ timeout: 10_000 })
    // 空态按钮有可见文案；工具栏仅 icon + aria-label，用 hasText 区分
    await this.page.getByRole('button', { name: '上传文件' }).filter({ hasText: '上传文件' }).click()
    await expect(this.uploadManagerDialog).toBeVisible({ timeout: 10_000 })
  }

  async closeUploadManager() {
    await this.uploadManagerDialog.getByRole('button', { name: '关闭' }).click()
    await expect(this.uploadManagerDialog).toHaveCount(0)
  }

  async setUploadFiles(
    files: { name: string; mimeType: string; buffer: Buffer }[],
  ): Promise<void> {
    await this.fileInput.setInputFiles(files)
  }

  async uploadTextFile(fileName: string, content: string, options?: { closeDialog?: boolean }) {
    const closeDialog = options?.closeDialog ?? true
    if ((await this.uploadManagerDialog.count()) === 0) {
      // 空态或工具栏
      if (await this.page.getByText('暂无文件').isVisible().catch(() => false)) {
        await this.openUploadManagerFromEmptyState()
      } else {
        await this.openUploadManagerFromToolbar()
      }
    }

    const uploadResponsePromise = this.page.waitForResponse(
      (r) => r.url().includes('/documents/upload') && r.request().method() === 'POST',
      { timeout: 60_000 },
    )

    await this.setUploadFiles([
      {
        name: fileName,
        mimeType: 'text/plain',
        buffer: Buffer.from(content, 'utf8'),
      },
    ])

    const res = await uploadResponsePromise
    expect(res.ok(), `上传失败: ${res.status()} ${await res.text().catch(() => '')}`).toBeTruthy()
    const body = (await res.json()) as { data?: { id?: string; status?: string }; id?: string }
    const docId = body.data?.id ?? body.id
    expect(docId, '上传响应缺少 document id').toBeTruthy()

    await expect(this.page.getByText('完成').first())
      .toBeVisible({ timeout: 30_000 })
      .catch(() => undefined)

    if (closeDialog) {
      await this.closeUploadManager()
    }

    return docId as string
  }

  /**
   * 文档状态徽标 UI 当前冻结，改用 Nest API 轮询 ready。
   * page.request 共享浏览器 Cookie jar（含 localhost:3100）。
   */
  async waitDocumentReady(kbId: string, docId: string, timeoutMs = 180_000) {
    const deadline = Date.now() + timeoutMs
    let lastStatus = 'unknown'

    while (Date.now() < deadline) {
      const res = await this.page.request.get(`${API_BASE}/api/knowledge-bases/${kbId}/documents`, {
        failOnStatusCode: false,
      })
      if (res.ok()) {
        const body = (await res.json()) as unknown
        const data =
          body && typeof body === 'object' && 'data' in body
            ? (body as { data: unknown }).data
            : body
        const arr = Array.isArray(data)
          ? data
          : data && typeof data === 'object' && 'items' in (data as object)
            ? ((data as { items: unknown[] }).items ?? [])
            : []
        const found = (arr as { id?: string; status?: string }[]).find((d) => d.id === docId)
        lastStatus = found?.status ?? lastStatus
        if (lastStatus === 'ready') return
        if (lastStatus === 'failed') {
          throw new Error(`文档索引失败 status=failed docId=${docId}`)
        }
      }
      await this.page.waitForTimeout(3000)
    }

    throw new Error(`等待文档 ready 超时，最终 status=${lastStatus} docId=${docId}`)
  }

  /** 延迟上传响应，便于测关窗 + mini 浮层 */
  async withDelayedUpload<T>(delayMs: number, fn: () => Promise<T>): Promise<T> {
    await this.page.route('**/documents/upload', async (route) => {
      await new Promise((r) => setTimeout(r, delayMs))
      await route.continue()
    })
    try {
      return await fn()
    } finally {
      await this.page.unroute('**/documents/upload').catch(() => undefined)
    }
  }

  /** 侧栏删除知识库（打开操作菜单 → 删除 → 确认） */
  async deleteKnowledgeBaseByName(name: string) {
    const row = this.page.locator('li').filter({ hasText: name }).first()
    await expect(row).toBeVisible({ timeout: 10_000 })
    await row.getByLabel('知识库操作').click()
    await this.page.getByRole('menuitem', { name: '删除' }).click()

    // AlertDialog 标题
    await expect(this.page.getByText('删除知识库', { exact: true })).toBeVisible({
      timeout: 10_000,
    })

    const deletePromise = this.page.waitForResponse(
      (r) =>
        r.url().includes('/knowledge-bases/') &&
        r.request().method() === 'DELETE' &&
        !r.url().includes('/documents'),
      { timeout: 20_000 },
    )
    // Footer 主操作「删除」
    await this.page.getByRole('button', { name: '删除', exact: true }).click()
    const res = await deletePromise
    expect(res.ok() || res.status() === 204, `删除知识库失败: ${res.status()}`).toBeTruthy()

    await expect(this.page.getByRole('button', { name: `选择知识库 ${name}` })).toHaveCount(0, {
      timeout: 15_000,
    })
  }
}
