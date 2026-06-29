import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchLoginHistory } from '@/features/profile/services'

const mockSend = vi.fn()

vi.mock('@/utils/server', () => ({
  alovaInstance: {
    Get: vi.fn(() => ({ send: mockSend })),
  },
}))

describe('profile services', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetchLoginHistory falls back to mock on error', async () => {
    mockSend.mockRejectedValueOnce(new Error('offline'))
    const h = await fetchLoginHistory()
    expect(h.length).toBeGreaterThan(0)
    for (const item of h) {
      expect(item.ip).toBeTruthy()
      expect(item.time).toBeTruthy()
    }
  })

  it('fetchLoginHistory returns real data on success', async () => {
    const fake = [{ id: '1', ip: '1.1.1.1', device: 'd', time: new Date().toISOString() }]
    mockSend.mockResolvedValueOnce(fake)
    expect(await fetchLoginHistory()).toEqual(fake)
  })
})
