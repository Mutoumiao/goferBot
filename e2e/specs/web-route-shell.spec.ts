/**
 * 路由驱动 Shell 验收（web-route-driven-shell）
 *
 * 覆盖：
 * - 登录落地 /chats、Icon Rail active、无 TabBar
 * - 旧路径 redirect
 * - 强制 KB：未选不可发送
 * - 会话选中本地状态（不写 ?c=）
 * - 知识库选中本地状态（不写 ?kb=）
 * - 一级菜单 Keep-Alive 往返恢复
 * - 登出后回到登录
 */
import { expect, test } from '@playwright/test'
import { loginAsWebUser } from '../fixtures/web-auth'
import { KnowledgeBasePage } from '../pages/KnowledgeBasePage'

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3100'

test.describe.configure({ mode: 'serial' })

test.describe('路由驱动 Shell', () => {
  test('登录落地 /chats：Rail 会话 active、无 TabBar、强制 KB 禁用发送', async ({ page }) => {
    test.setTimeout(90_000)
    await loginAsWebUser(page)

    await expect(page).toHaveURL(/\/chats/)
    await expect(page.getByTestId('chats-page')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('icon-rail')).toBeVisible()
    await expect(page.getByTestId('rail-chats')).toHaveAttribute('aria-current', 'page')
    await expect(page.getByTestId('rail-chats')).toHaveAttribute('data-active', 'true')
    await expect(page.getByTestId('rail-knowledgeBase')).not.toHaveAttribute('aria-current', 'page')
    await expect(page.getByTestId('tab-bar')).toHaveCount(0)
    await expect(page.getByTestId('session-list-panel')).toBeVisible()
    await expect(page.getByTestId('kb-selector-trigger')).toBeVisible()
    await expect(page.getByTestId('temp-send-btn')).toBeDisabled()

    const textarea = page.locator('[data-testid="chat-empty-home"] textarea, textarea').first()
    await textarea.fill('未选知识库的测试问题')
    await expect(page.getByTestId('temp-send-btn')).toBeDisabled()
  })

  test('已删除旧 path 无 redirect 壳：/chat、/history 不进入会话工作台契约路由', async ({
    page,
  }) => {
    test.setTimeout(60_000)
    await loginAsWebUser(page)

    // 零兼容：不再注册 redirect 壳；访问旧 path 不得落到「会话工作台」契约
    await page.goto('/chat', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('chats-page')).toHaveCount(0, { timeout: 10_000 })
    await expect(page).not.toHaveURL(/\/chats\/?$/, { timeout: 5_000 })

    await page.goto('/history', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('chats-page')).toHaveCount(0, { timeout: 10_000 })
    await expect(page).not.toHaveURL(/\/chats\/?$/, { timeout: 5_000 })
  })

  test('Icon Rail 切换：知识库/设置/回收站 active 互斥', async ({ page }) => {
    test.setTimeout(90_000)
    await loginAsWebUser(page)

    await page.getByTestId('rail-knowledgeBase').click()
    await expect(page).toHaveURL(/\/knowledgeBase/, { timeout: 15_000 })
    await expect(page.getByTestId('rail-knowledgeBase')).toHaveAttribute('aria-current', 'page')
    await expect(page.getByTestId('rail-chats')).not.toHaveAttribute('aria-current', 'page')
    await expect(page.getByTestId('kb-page')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('tab-bar')).toHaveCount(0)

    await page.getByTestId('rail-settings').click()
    await expect(page).toHaveURL(/\/settings/, { timeout: 15_000 })
    await expect(page.getByTestId('rail-settings')).toHaveAttribute('aria-current', 'page')

    await page.getByTestId('rail-recycle').click()
    await expect(page).toHaveURL(/\/recycle/, { timeout: 15_000 })
    await expect(page.getByTestId('rail-recycle')).toHaveAttribute('aria-current', 'page')

    await page.getByTestId('rail-chats').click()
    await expect(page).toHaveURL(/\/chats/, { timeout: 15_000 })
    await expect(page.getByTestId('rail-chats')).toHaveAttribute('aria-current', 'page')
  })

  test('一级页 Keep-Alive：会话输入草稿往返知识库后仍保留', async ({ page }) => {
    test.setTimeout(90_000)
    await loginAsWebUser(page)

    await page.goto('/chats', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('chats-page')).toBeVisible({ timeout: 20_000 })

    const draft = `keepalive-draft-${Date.now()}`
    const textarea = page.locator('[data-testid="chat-empty-home"] textarea, textarea').first()
    await textarea.fill(draft)
    await expect(textarea).toHaveValue(draft)

    await page.getByTestId('rail-knowledgeBase').click()
    await expect(page).toHaveURL(/\/knowledgeBase/, { timeout: 15_000 })
    await expect(page.getByTestId('kb-page')).toBeVisible({ timeout: 15_000 })

    await page.getByTestId('rail-chats').click()
    await expect(page).toHaveURL(/\/chats/, { timeout: 15_000 })
    await expect(page.getByTestId('chats-page')).toBeVisible({ timeout: 15_000 })

    const textareaBack = page.locator('[data-testid="chat-empty-home"] textarea, textarea').first()
    await expect(textareaBack).toHaveValue(draft, { timeout: 10_000 })
  })

  test('非法 search 被忽略，/chats 仍显示空态', async ({ page }) => {
    test.setTimeout(60_000)
    await loginAsWebUser(page)

    await page.goto('/chats?c=nonexistent-session-id-e2e-404', {
      waitUntil: 'domcontentloaded',
    })

    await expect(page.getByTestId('chats-page')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('chat-empty-home')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('chat-home-greeting')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('temp-send-btn')).toBeVisible()
  })

  test('知识库选中为本地状态，不写 ?kb=，往返菜单保持选中', async ({ page }) => {
    test.setTimeout(120_000)
    await loginAsWebUser(page)

    const kbPage = new KnowledgeBasePage(page)
    const kbName = `pw-shell-kb-${Date.now()}`
    await kbPage.createKnowledgeBase(kbName)

    await expect(page.getByTestId('kb-page')).toBeVisible()
    await expect(page.getByTestId('rail-knowledgeBase')).toHaveAttribute('aria-current', 'page')
    // 不再把选中写入 URL
    await expect(page).toHaveURL(/\/knowledgeBase\/?$/, { timeout: 15_000 })
    await expect(page.getByRole('button', { name: `选择知识库 ${kbName}` })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await page.getByTestId('rail-chats').click()
    await expect(page).toHaveURL(/\/chats/, { timeout: 15_000 })

    await page.getByTestId('rail-knowledgeBase').click()
    await expect(page).toHaveURL(/\/knowledgeBase/, { timeout: 15_000 })
    await expect(page.getByRole('button', { name: `选择知识库 ${kbName}` })).toHaveAttribute(
      'aria-pressed',
      'true',
      { timeout: 15_000 },
    )
  })

  test('会话列表选中为本地状态，新会话清空选中并显示空态', async ({ page }) => {
    test.setTimeout(120_000)
    await loginAsWebUser(page)

    const createRes = await page.request.post(`${API_BASE}/api/sessions`, {
      data: { title: `e2e-shell-sess-${Date.now()}` },
      failOnStatusCode: false,
      headers: { 'X-App-Context': 'web', 'Content-Type': 'application/json' },
    })
    if (createRes.ok()) {
      const body = (await createRes.json().catch(() => ({}))) as {
        data?: { id?: string }
        id?: string
      }
      const sessionId = body.data?.id ?? body.id
      if (sessionId) {
        await page.goto('/chats', { waitUntil: 'domcontentloaded' })
        await expect(page.getByTestId('session-list-panel')).toBeVisible({ timeout: 20_000 })

        const item = page.getByTestId(`session-item-${sessionId}`)
        if (!(await item.isVisible().catch(() => false))) {
          await page.reload({ waitUntil: 'domcontentloaded' })
        }
        if (await item.isVisible().catch(() => false)) {
          await item.click()
          // 不写 URL search
          await expect(page).toHaveURL(/\/chats\/?$/, { timeout: 10_000 })
          await expect(item).toHaveAttribute('data-active', 'true')

          // 点「智能对话」回到空态（新会话由右侧发送后创建，不再有单独 + 新会话按钮）
          await page.getByTestId('session-home-entry').click()
          await expect(page).toHaveURL(/\/chats\/?$/, { timeout: 10_000 })
          await expect(page.getByTestId('chat-empty-home')).toBeVisible({ timeout: 10_000 })
          await expect(page.getByTestId('chat-home-greeting')).toBeVisible({ timeout: 10_000 })
          await expect(page.getByTestId('temp-send-btn')).toBeVisible()
          return
        }
      }
    }

    await page.goto('/chats', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('session-list-panel')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('session-home-entry')).toBeVisible()
    await page.getByTestId('session-home-entry').click()
    await expect(page).toHaveURL(/\/chats/, { timeout: 10_000 })
    await expect(page.getByTestId('chat-empty-home')).toBeVisible({ timeout: 10_000 })
  })

  test('登出离开工作区，再登录仍落地 /chats', async ({ page }) => {
    test.setTimeout(90_000)
    await loginAsWebUser(page)

    await page.goto('/profile', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: '退出登录' }).click()
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 })

    await page.goto('/chats', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 })

    await loginAsWebUser(page)
    await expect(page).toHaveURL(/\/chats/, { timeout: 30_000 })
    await expect(page.getByTestId('icon-rail')).toBeVisible({ timeout: 15_000 })
  })
})
