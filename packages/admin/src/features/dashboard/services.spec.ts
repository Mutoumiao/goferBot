import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DashboardSummary } from '@/features/dashboard/services'
import { getDashboardSummary } from '@/features/dashboard/services'

const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn(),
}))

vi.mock('@/api/dashboard', () => ({
  fetchDashboardSummary: () => ({ send: mockSend }),
  fetchRagObservability: () => ({ send: mockSend }),
  fetchCompanionObservability: () => ({ send: mockSend }),
}))

const sampleSummary: DashboardSummary = {
  window: '24h',
  generatedAt: '2026-07-16T00:00:00.000Z',
  health: {
    status: 'ok',
    components: [{ name: 'postgres', status: 'ok', latencyMs: 1 }],
  },
  rag: {
    emptyRate: { status: 'ready', value: 0.1, sampleSize: 10 },
    degradedRate: { status: 'pending_instrumentation' },
    indexFailureCount: { status: 'ready', value: 2 },
  },
  companion: {
    p95LatencyMs: { status: 'insufficient_samples', sampleSize: 0 },
    qualityFailRate: { status: 'ready', value: 0.05, sampleSize: 20 },
    safetyHardStopRate: { status: 'ready', value: 0, sampleSize: 10 },
    negativeFeedbackRate: { status: 'insufficient_samples', sampleSize: 0 },
  },
  inventory: {
    userCount: 1,
    knowledgeBaseCount: 2,
    documentCount: 3,
    companionCount: 4,
  },
}

describe('dashboard services', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('VITE_USE_DASHBOARD_MOCK', '')
  })

  it('returns real summary when api succeeds', async () => {
    mockSend.mockResolvedValueOnce(sampleSummary)
    const data = await getDashboardSummary('24h')
    expect(data).toEqual(sampleSummary)
    expect(data.health.components[0]?.name).toBe('postgres')
    expect(data.rag.indexFailureCount.value).toBe(2)
  })

  it('propagates api errors instead of silent mock fallback', async () => {
    mockSend.mockRejectedValueOnce(new Error('network down'))
    await expect(getDashboardSummary()).rejects.toThrow('network down')
  })

  it('uses explicit env mock only when VITE_USE_DASHBOARD_MOCK=1', async () => {
    vi.stubEnv('VITE_USE_DASHBOARD_MOCK', '1')
    const data = await getDashboardSummary('1h')
    expect(mockSend).not.toHaveBeenCalled()
    expect(data.window).toBe('1h')
    expect(data.inventory.userCount).toBeGreaterThan(0)
    expect(data.health.status).toBe('ok')
  })
})
