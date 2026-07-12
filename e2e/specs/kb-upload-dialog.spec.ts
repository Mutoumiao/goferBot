/**
 * Web 知识库上传管理弹窗 E2E（对应 Trellis 07-10-web-kb-upload-dialog）
 *
 * 覆盖 AC（MVP）：
 *   AC1  内容区干净（无常驻 DropZone / 任务条）
 *   AC2  工具栏打开上传管理弹窗
 *   AC3  合法文件入队并完成
 *   AC4  非法文件仅弹窗内提示
 *   AC6  上传后列表刷新
 *   AC8  关窗不中断；出现 mini 浮层
 *   AC9  浮层可再开完整弹窗
 *   AC13 任务结束后弹窗仍保持打开
 *   AC15 空态「上传文件」进同一弹窗
 *
 * 前置：Web :1420 + Nest :3100
 *
 * 运行：
 *   WEB_SERVER_URL=http://localhost:1420 pnpm exec playwright test --config e2e/playwright.config.ts e2e/specs/kb-upload-dialog.spec.ts
 */
import { expect, test } from '@playwright/test'
import { loginAsWebUser } from '../fixtures/web-auth'
import { KnowledgeBasePage } from '../pages/KnowledgeBasePage'

test.describe.configure({ mode: 'serial' })

test.describe('知识库上传管理弹窗（07-10）', () => {
  test('空态入口 / 内容区干净 / 非法文件 / 合法上传 / 关窗浮层', async ({ page }) => {
    test.setTimeout(180_000)

    const kbPage = new KnowledgeBasePage(page)
    const kbName = `pw-upload-${Date.now()}`

    await loginAsWebUser(page)
    await kbPage.openFromSidebar()
    await kbPage.createKnowledgeBase(kbName)

    // ── AC15 + AC1：空态有上传入口；内容区无 DropZone ──
    // 若列表曾报参数错，点重试（breadcrumbs 空 folderId 已修）
    const retryBtn = page.getByRole('button', { name: '重试' })
    if (await retryBtn.isVisible().catch(() => false)) {
      await retryBtn.click()
    }
    await expect(page.getByText('暂无文件')).toBeVisible({ timeout: 15_000 })
    await kbPage.expectCleanContentArea()
    await kbPage.openUploadManagerFromEmptyState()
    await expect(kbPage.uploadDropZone).toBeVisible()
    await kbPage.closeUploadManager()
    await kbPage.expectCleanContentArea()

    // ── AC2：工具栏再次打开 ──
    await kbPage.openUploadManagerFromToolbar()

    // ── AC4：非法扩展名仅弹窗内 ──
    await kbPage.setUploadFiles([
      {
        name: 'malware.exe',
        mimeType: 'application/octet-stream',
        buffer: Buffer.from('not-a-real-exe'),
      },
    ])
    await expect(page.getByTestId('rejected-file')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByTestId('rejected-file')).toContainText(/不支持|类型|非法|exe/i)
    // 内容区仍无常驻校验条（校验在弹窗内）
    await expect(kbPage.uploadManagerDialog.getByTestId('rejected-file')).toBeVisible()

    // ── AC8/AC9：延迟上传 → 关窗 → mini → 再开 ──
    await kbPage.closeUploadManager()
    await kbPage.expectCleanContentArea()

    await kbPage.withDelayedUpload(4_000, async () => {
      await kbPage.openUploadManagerFromToolbar()

      const uploadPromise = page.waitForResponse(
        (r) => r.url().includes('/documents/upload') && r.request().method() === 'POST',
        { timeout: 30_000 },
      )

      await kbPage.setUploadFiles([
        {
          name: 'upload-dialog-ok.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from('Playwright upload dialog AC3/AC8\n'),
        },
      ])

      // 弹窗仍开时不应显示 mini（互斥）
      await expect(kbPage.uploadMiniPanel).toHaveCount(0)

      // 关窗不中断（AC8）
      await kbPage.closeUploadManager()
      await expect(kbPage.uploadMiniPanel).toBeVisible({ timeout: 5_000 })

      // AC9：点击浮层主体重开
      await kbPage.uploadMiniPanel.getByLabel('打开上传管理').click()
      await expect(kbPage.uploadManagerDialog).toBeVisible({ timeout: 10_000 })
      await expect(kbPage.uploadMiniPanel).toHaveCount(0)

      const res = await uploadPromise
      expect(res.ok(), `上传 HTTP ${res.status()}`).toBeTruthy()
    })

    // ── AC3/AC13：完成后弹窗仍打开，可见完成态 ──
    await expect(kbPage.uploadManagerDialog).toBeVisible()
    await expect(page.getByText('完成').first()).toBeVisible({ timeout: 30_000 })

    // ── AC6：关窗后列表出现文件名 ──
    await kbPage.closeUploadManager()
    await expect(page.getByText('upload-dialog-ok.txt')).toBeVisible({ timeout: 15_000 })
    await kbPage.expectCleanContentArea()
  })
})
