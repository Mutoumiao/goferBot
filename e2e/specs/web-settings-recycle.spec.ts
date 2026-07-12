/**
 * Web 设置写操作 + 回收站冒烟（真实后端）
 *
 * 覆盖：
 *   - 设置页切换外观并触发保存
 *   - 删除知识库后侧栏消失
 *   - 回收站页可打开（空态或含条目，取决于是否软删除）
 *
 * 运行：
 *   WEB_SERVER_URL=http://localhost:1420 pnpm exec playwright test --config e2e/playwright.config.ts e2e/specs/web-settings-recycle.spec.ts
 */
import { expect, test } from '@playwright/test'
import { loginAsWebUser } from '../fixtures/web-auth'
import { KnowledgeBasePage } from '../pages/KnowledgeBasePage'

test.describe.configure({ mode: 'serial' })

test.describe('设置与回收站', () => {
  test('切换外观模式并保存', async ({ page }) => {
    test.setTimeout(60_000)
    await loginAsWebUser(page)

    await page.goto('/settings', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: '设置', exact: true })).toBeVisible({
      timeout: 15_000,
    })

    // 设置页「界面显示」行的 combobox（Radix SelectTrigger）
    await expect(page.getByText('界面显示')).toBeVisible()
    const appearanceTrigger = page.getByRole('combobox').first()
    await expect(appearanceTrigger).toBeVisible({ timeout: 10_000 })

    const savePromise = page.waitForResponse(
      (r) =>
        (r.url().includes('/settings/appearance') || r.url().endsWith('/settings')) &&
        ['POST', 'PUT', 'PATCH'].includes(r.request().method()),
      { timeout: 15_000 },
    )

    // 先读当前值，再选另一项，确保触发 onChange → saveConfig
    const before = (await appearanceTrigger.innerText()).trim()
    await appearanceTrigger.click()
    await expect(page.getByRole('option').first()).toBeVisible({ timeout: 5_000 })
    const candidates = ['浅色模式', '深色模式', '跟随系统']
    const next =
      candidates.find((c) => !before.includes(c.slice(0, 2))) ??
      (before.includes('深色') ? '浅色模式' : '深色模式')
    await page.getByRole('option', { name: next }).click()

    await expect(appearanceTrigger).toContainText(/浅色|深色|跟随/, { timeout: 5_000 })

    const saveRes = await savePromise
    expect(
      saveRes.ok(),
      `保存设置 HTTP ${saveRes.status()} ${await saveRes.text().catch(() => '')}`,
    ).toBeTruthy()
  })

  test('删除知识库后侧栏移除，回收站页可访问', async ({ page }) => {
    test.setTimeout(90_000)
    await loginAsWebUser(page)

    const kbPage = new KnowledgeBasePage(page)
    const kbName = `pw-recycle-${Date.now()}`

    await kbPage.openFromSidebar()
    await kbPage.createKnowledgeBase(kbName)
    await kbPage.deleteKnowledgeBaseByName(kbName)

    await page.goto('/recycle', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: '回收站' })).toBeVisible({ timeout: 15_000 })
    // 硬删除 → 空态；软删除 → 可能见名称。页面可用即可
    await expect(
      page.getByText('回收站为空', { exact: true }).or(page.getByText(kbName, { exact: true })),
    ).toBeVisible({ timeout: 15_000 })
  })
})
