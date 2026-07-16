import type { DashboardSummary, ObservabilityWindow } from '@goferbot/data'
import { fetchDashboardSummary } from '@/api/dashboard'

export type { DashboardSummary }

/**
 * 获取 Hub 摘要。生产路径禁止静默 mock 顶替；
 * 仅当显式 USE_DASHBOARD_MOCK=1（Vite 环境）时才允许开发 fixture。
 */
export async function getDashboardSummary(
  window: ObservabilityWindow = '24h',
): Promise<DashboardSummary> {
  if (import.meta.env.VITE_USE_DASHBOARD_MOCK === '1') {
    return getDevMockSummary(window)
  }
  return fetchDashboardSummary(window).send()
}

/** @deprecated 使用 getDashboardSummary */
export async function getDashboardData(): Promise<DashboardSummary> {
  return getDashboardSummary('24h')
}

function getDevMockSummary(window: ObservabilityWindow): DashboardSummary {
  return {
    window,
    generatedAt: new Date().toISOString(),
    health: {
      status: 'ok',
      components: [
        { name: 'postgres', status: 'ok', latencyMs: 2 },
        { name: 'redis', status: 'ok', latencyMs: 1 },
        { name: 'minio', status: 'ok', latencyMs: 5 },
        { name: 'knowledge-ai', status: 'ok', latencyMs: 12 },
      ],
    },
    rag: {
      emptyRate: { status: 'ready', value: 0.08, sampleSize: 100 },
      degradedRate: { status: 'ready', value: 0.02, sampleSize: 100 },
      indexFailureCount: { status: 'ready', value: 3 },
    },
    companion: {
      p95LatencyMs: { status: 'ready', value: 1800, unit: 'ms', sampleSize: 50 },
      qualityFailRate: {
        status: 'ready',
        value: 0.05,
        sampleSize: 50,
        note: '观测型',
      },
      safetyHardStopRate: { status: 'ready', value: 0.01, sampleSize: 200 },
      negativeFeedbackRate: { status: 'insufficient_samples', sampleSize: 0 },
    },
    inventory: {
      userCount: 12,
      knowledgeBaseCount: 4,
      documentCount: 28,
      companionCount: 6,
    },
  }
}
