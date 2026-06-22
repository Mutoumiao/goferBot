import { describe, expect, it, vi, beforeEach } from 'vitest'
import { getDashboardData } from '@/features/dashboard/services'

vi.mock('@/utils/server', () => ({
  alovaInstance: {
    Get: vi.fn(() => ({
      send: () => Promise.reject(new Error('network down')),
    })),
  },
}))

describe('dashboard services', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('falls back to mock data when real api is unreachable', async () => {
    const data = await getDashboardData()
    expect(data.stats.userCount).toBeGreaterThan(0)
    expect(data.activities.length).toBeGreaterThan(0)
    expect(['running', 'idle', 'stopped']).toContain(data.health.queueStatus)
    expect(data.ragStats.total).toBeGreaterThan(0)
  })

  it('mock data structure matches DashboardData contract', async () => {
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
