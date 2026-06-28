import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockSend = vi.fn()
vi.mock('@/utils/server', () => ({
  alovaInstance: {
    Get: vi.fn(() => ({ send: mockSend })),
  },
}))

import { fetchRagTasks } from '@/features/rag-observability/services'

describe('rag-observability services', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns mock data when backend is unreachable', async () => {
    mockSend.mockRejectedValueOnce(new Error('offline'))
    const tasks = await fetchRagTasks()
    expect(Array.isArray(tasks)).toBe(true)
    expect(tasks.length).toBeGreaterThan(0)
    for (const t of tasks) {
      expect(['pending', 'running', 'succeeded', 'failed']).toContain(t.status)
      expect(['indexing', 'query', 'chunking']).toContain(t.type)
      expect(t.progress).toBeGreaterThanOrEqual(0)
      expect(t.progress).toBeLessThanOrEqual(100)
    }
  })

  it('uses real data when backend is reachable', async () => {
    const fake = [
      {
        id: 't1',
        type: 'indexing' as const,
        status: 'succeeded' as const,
        progress: 100,
        durationMs: 100,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]
    mockSend.mockResolvedValueOnce(fake)
    const tasks = await fetchRagTasks()
    expect(tasks).toEqual(fake)
  })
})
