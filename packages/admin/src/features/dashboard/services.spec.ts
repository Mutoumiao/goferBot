import { describe, expect, it, vi, beforeEach } from 'vitest'
import { getDashboardData } from '@/features/dashboard/services'

const { mockFetch } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
}))

vi.mock('@/api/dashboard', () => ({
  fetchDashboardData: mockFetch,
}))

describe('dashboard services', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns real data when api succeeds', async () => {
    const fake = {
      stats: { userCount: 1, sessionCount: 0, documentCount: 0, ragTaskCount: 0, userGrowth: 0, sessionGrowth: 0, documentGrowth: 0, ragTaskGrowth: 0 },
      activities: [],
      health: { cpu: 0, memory: 0, disk: 0, queueStatus: 'idle' as const },
      ragStats: { total: 0, running: 0, succeeded: 0, failed: 0, pending: 0 },
    }
    mockFetch.mockResolvedValueOnce(fake)
    const data = await getDashboardData()
    expect(data).toEqual(fake)
  })

  it('falls back to mock data when real api is unreachable', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network down'))
    const data = await getDashboardData()
    expect(data.stats.userCount).toBeGreaterThan(0)
    expect(data.activities.length).toBeGreaterThan(0)
    expect(['running', 'idle', 'stopped']).toContain(data.health.queueStatus)
    expect(data.ragStats.total).toBeGreaterThan(0)
  })

  it('mock data structure matches DashboardData contract', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network down'))
    const data = await getDashboardData()
    expect(Object.keys(data.stats).sort()).toEqual(
      ['documentCount', 'documentGrowth', 'ragTaskCount', 'ragTaskGrowth', 'sessionCount', 'sessionGrowth', 'userCount', 'userGrowth'].sort(),
    )
    expect(Object.keys(data.health).sort()).toEqual(['cpu', 'disk', 'memory', 'queueStatus'].sort())
    for (const a of data.activities) {
      expect(['login', 'create', 'delete', 'rag']).toContain(a.icon)
      expect(a.id).toBeTruthy()
      expect(a.time).toBeTruthy()
    }
  })
})
