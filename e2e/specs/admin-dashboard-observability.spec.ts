/**
 * Admin Dashboard 观测 Hub + 详页 E2E（真实后端）
 *
 * 覆盖：
 *   - 登录后 Hub 展示健康 / RAG / Companion KPI（无假 CPU/环比）
 *   - summary API 200 + 契约字段
 *   - 时间窗切换会重新请求 summary
 *   - 有 system:metrics 时「查看详情」进入 RAG 详页
 *   - 直链 companion 详页 sections 可见；retrieval 待埋点文案
 *
 * 前置：Admin http://localhost:1421 + Nest :3100（已 migrate + prisma generate）
 *
 * 运行：
 *   pnpm test:e2e:admin
 *   或：
 *   WEB_SERVER_URL=http://localhost:1421 ADMIN_SERVER_URL=http://localhost:1421 \
 *     pnpm exec playwright test --config e2e/playwright.config.ts e2e/specs/admin-dashboard-observability.spec.ts
 */
import { expect, test } from '@playwright/test'
import { loginAsAdmin } from '../fixtures/admin-auth'
import { AdminPage } from '../pages/AdminPage'

const ADMIN_URL = process.env.ADMIN_SERVER_URL || 'http://localhost:1421'

test.use({ baseURL: ADMIN_URL })

test.describe.configure({ mode: 'serial' })

test.describe('Admin Dashboard 观测（真实后端）', () => {
  test('Hub summary 契约 + 详页可进', async ({ page }) => {
    test.setTimeout(120_000)

    const admin = new AdminPage(page)

    const summaryPromise = page.waitForResponse(
      (r) =>
        r.request().method() === 'GET' &&
        r.url().includes('/admin/dashboard/summary') &&
        r.status() === 200,
      { timeout: 30_000 },
    )

    await loginAsAdmin(page)
    const summaryRes = await summaryPromise
    const summaryJson = await summaryRes.json()
    const summary = (summaryJson?.data ?? summaryJson) as Record<string, unknown>

    expect(summary.window === '24h' || summary.window === '1h' || summary.window === '7d').toBe(
      true,
    )
    expect(summary.health).toBeTruthy()
    expect(summary.rag).toBeTruthy()
    expect(summary.companion).toBeTruthy()
    expect(summary.inventory).toBeTruthy()

    const health = summary.health as { status?: string; components?: unknown[] }
    expect(['ok', 'degraded', 'down']).toContain(health.status)
    expect(Array.isArray(health.components)).toBe(true)

    await admin.expectObservabilityHub()

    // 时间窗切换 → 再次请求 summary
    const windowResPromise = page.waitForResponse(
      (r) =>
        r.request().method() === 'GET' &&
        r.url().includes('/admin/dashboard/summary') &&
        r.url().includes('window='),
      { timeout: 20_000 },
    )
    await page.getByText('7 天', { exact: true }).click()
    const windowRes = await windowResPromise
    expect(windowRes.ok()).toBeTruthy()
    expect(windowRes.url()).toMatch(/window=7d/)

    // 详情入口（完整权限 seed 管理员应有 system:metrics）
    const detailLink = page.getByRole('link', { name: /查看详情/ })
    const detailCount = await detailLink.count()
    if (detailCount === 0) {
      test.info().annotations.push({
        type: 'note',
        description: '当前账号无 system:metrics，跳过详页入口点击',
      })
    } else {
      const ragDetailPromise = page.waitForResponse(
        (r) =>
          r.request().method() === 'GET' &&
          r.url().includes('/admin/observability/rag') &&
          r.status() === 200,
        { timeout: 20_000 },
      )
      await admin.openRagDetailFromHub()
      const ragRes = await ragDetailPromise
      const ragJson = await ragRes.json()
      const rag = (ragJson?.data ?? ragJson) as {
        sections?: Record<string, unknown>
        kpis?: unknown[]
      }
      expect(rag.sections?.index).toBeTruthy()
      expect(rag.sections?.retrieve).toBeTruthy()
      expect(rag.sections?.quality_deps).toBeTruthy()
      await expect(page.getByText('索引').first()).toBeVisible()
      await expect(page.getByText('检索').first()).toBeVisible()
      await expect(page.getByRole('button', { name: /返回控制台/ })).toBeVisible()
    }

    // Companion 详页直链
    const companionDetailPromise = page.waitForResponse(
      (r) =>
        r.request().method() === 'GET' &&
        r.url().includes('/admin/observability/companion') &&
        (r.status() === 200 || r.status() === 403),
      { timeout: 20_000 },
    )
    await admin.gotoCompanionObservability('24h')
    const companionRes = await companionDetailPromise
    if (companionRes.status() === 403) {
      // 无 metrics 权限：页面应错误态而非假数据 KPI
      await expect(page.getByText(/失败|无权|403|错误/).first()).toBeVisible({ timeout: 10_000 })
    } else {
      const body = await companionRes.json()
      const detail = (body?.data ?? body) as {
        sections?: { retrieval?: { status?: string }; cost_safety?: unknown }
      }
      expect(detail.sections?.retrieval?.status).toBe('pending_instrumentation')
      expect(detail.sections?.cost_safety).toBeTruthy()
      await expect(page.getByText(/检索质量|尚未接入|不伪造/).first()).toBeVisible()
      await expect(page.getByText('延迟').first()).toBeVisible()
      await expect(page.getByText(/成本与安全/).first()).toBeVisible()
    }
  })
})
