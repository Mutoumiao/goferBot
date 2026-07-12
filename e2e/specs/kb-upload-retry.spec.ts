/**
 * 上传失败重试（07-10 AC5）
 *
 * 用 route 模拟一次上传失败，再取消拦截后点「重试」。
 *
 * 运行：
 *   WEB_SERVER_URL=http://localhost:1420 pnpm exec playwright test --config e2e/playwright.config.ts e2e/specs/kb-upload-retry.spec.ts
 */
import { expect, test } from '@playwright/test'
import { loginAsWebUser } from '../fixtures/web-auth'
import { KnowledgeBasePage } from '../pages/KnowledgeBasePage'

test.describe.configure({ mode: 'serial' })

test.describe('知识库上传失败重试（07-10 AC5）', () => {
  test('模拟失败后可在弹窗内重试并完成', async ({ page }) => {
    test.setTimeout(120_000)

    const kbPage = new KnowledgeBasePage(page)
    const kbName = `pw-retry-${Date.now()}`

    await loginAsWebUser(page)
    await kbPage.openFromSidebar()
    await kbPage.createKnowledgeBase(kbName)

    // 第一次上传强制 500
    let failOnce = true
    await page.route('**/documents/upload', async (route) => {
      if (failOnce && route.request().method() === 'POST') {
        failOnce = false
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'simulated upload failure' },
          }),
        })
        return
      }
      await route.continue()
    })

    await kbPage.openUploadManagerFromEmptyState()
    await kbPage.setUploadFiles([
      {
        name: 'retry-me.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('retry upload content\n'),
      },
    ])

    // 失败态 + 重试按钮
    await expect(page.getByText(/失败|错误|重试/).first()).toBeVisible({ timeout: 20_000 })
    const retryBtn = page.getByRole('button', { name: '重试' }).first()
    await expect(retryBtn).toBeVisible({ timeout: 10_000 })

    const uploadOk = page.waitForResponse(
      (r) =>
        r.url().includes('/documents/upload') &&
        r.request().method() === 'POST' &&
        r.status() < 500,
      { timeout: 30_000 },
    )
    await retryBtn.click()
    const res = await uploadOk
    expect(res.ok(), `重试上传 HTTP ${res.status()}`).toBeTruthy()

    await expect(page.getByText('完成').first()).toBeVisible({ timeout: 30_000 })

    await kbPage.closeUploadManager()
    await expect(page.getByText('retry-me.txt')).toBeVisible({ timeout: 15_000 })
  })
})
