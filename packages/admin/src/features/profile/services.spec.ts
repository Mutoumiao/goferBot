import { describe, expect, it, vi, beforeEach } from 'vitest'
import { changePasswordService, fetchLoginHistory } from '@/features/profile/services'
import { toast } from 'sonner'

const mockChange = vi.fn()
const mockSend = vi.fn()

vi.mock('@/api/auth', () => ({
  changePassword: (d: unknown) => ({ send: () => mockChange(d) }),
}))

vi.mock('@/utils/server', () => ({
  alovaInstance: {
    Get: vi.fn(() => ({ send: mockSend })),
  },
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

describe('profile services', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('changePasswordService returns success', async () => {
    mockChange.mockResolvedValueOnce(undefined)
    const r = await changePasswordService('old', 'new')
    expect(r.success).toBe(true)
    expect(toast.success).toHaveBeenCalled()
  })

  it('changePasswordService returns error on failure', async () => {
    mockChange.mockRejectedValueOnce(new Error('bad'))
    const r = await changePasswordService('old', 'new')
    expect(r.success).toBe(false)
    expect(r.error).toBeTruthy()
    expect(toast.error).toHaveBeenCalled()
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
