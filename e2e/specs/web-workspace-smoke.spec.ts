/**
 * Web 工作区主页面冒烟（真实后端）
 *
 * 覆盖：登录后侧栏各主路由可打开且关键标题/空态可见。
 */
import { expect, test } from '@playwright/test'
import { loginAsWebUser } from '../fixtures/web-auth'

test.describe.configure({ mode: 'serial' })

test.describe('Web 工作区主路由冒烟', () => {
  test('登录后可打开 chats / 知识库 / 伴侣 / 设置 / 回收站 / 个人资料', async ({ page }) => {
    test.setTimeout(120_000)

    await loginAsWebUser(page)

    // 会话页
    await page.goto('/chats', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('chat-empty-home')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('chat-home-greeting')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('temp-send-btn')).toBeVisible()
    await expect(page.getByTestId('kb-selector-trigger')).toBeVisible()
    await expect(page.getByTestId('session-list-panel')).toBeVisible()
    await expect(page.getByTestId('icon-rail')).toBeVisible()
    await expect(page.getByTestId('rail-chats')).toHaveAttribute('aria-current', 'page')
    // 无顶部 TabBar
    await expect(page.getByTestId('tab-bar')).toHaveCount(0)

    // 已删除兼容壳：旧 path 不应伪装成 /chats 工作台
    await page.goto('/chat', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('chats-page')).toHaveCount(0, { timeout: 10_000 })

    // 知识库
    await page.goto('/knowledgeBase', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: '知识库', exact: true })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByTestId('rail-knowledgeBase')).toHaveAttribute('aria-current', 'page')

    // AI 伴侣（默认「官方推荐」Tab；新建按钮在「我的伴侣」）
    await page.goto('/companions', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('tab', { name: '官方推荐' })).toBeVisible({ timeout: 15_000 })
    await page.getByRole('tab', { name: '我的伴侣' }).click()
    await expect(page.getByRole('button', { name: /新建伴侣/ }).first()).toBeVisible({
      timeout: 15_000,
    })

    // 设置
    await page.goto('/settings', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: '设置', exact: true })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByText('通用设置')).toBeVisible()

    // 回收站
    await page.goto('/recycle', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: '回收站' })).toBeVisible({ timeout: 15_000 })

    // 个人资料
    await page.goto('/profile', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText(/基础信息|个人资料|用户名|邮箱/).first()).toBeVisible({
      timeout: 15_000,
    })
  })
})
