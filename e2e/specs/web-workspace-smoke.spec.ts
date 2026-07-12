/**
 * Web 工作区主页面冒烟（真实后端）
 *
 * 覆盖：登录后侧栏各主路由可打开且关键标题/空态可见。
 *
 * 运行：
 *   WEB_SERVER_URL=http://localhost:1420 pnpm exec playwright test --config e2e/playwright.config.ts e2e/specs/web-workspace-smoke.spec.ts
 */
import { expect, test } from '@playwright/test'
import { loginAsWebUser } from '../fixtures/web-auth'

test.describe.configure({ mode: 'serial' })

test.describe('Web 工作区主路由冒烟', () => {
  test('登录后可打开 chat / 知识库 / 伴侣 / 历史 / 设置 / 回收站 / 个人资料', async ({
    page,
  }) => {
    test.setTimeout(120_000)

    await loginAsWebUser(page)

    // Chat 首页
    await page.goto('/chat', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('今天想从知识库里理解什么？')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('temp-send-btn')).toBeVisible()
    await expect(page.getByTestId('kb-selector-trigger')).toBeVisible()

    // 知识库
    await page.goto('/knowledgeBase', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: '知识库', exact: true })).toBeVisible({
      timeout: 15_000,
    })
    await expect(
      page.getByRole('button', { name: /新建知识库|创建/ }).first(),
    ).toBeVisible()

    // AI 伴侣
    await page.goto('/companions', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('button', { name: /新建伴侣/ }).first()).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByRole('tab', { name: '全部' }).or(page.getByText('全部'))).toBeVisible()

    // 会话历史
    await page.goto('/history', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: '会话历史' })).toBeVisible({ timeout: 15_000 })

    // 设置
    await page.goto('/settings', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: '设置', exact: true })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByText('通用设置')).toBeVisible()
    await expect(page.getByText('我的模型')).toBeVisible()

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
