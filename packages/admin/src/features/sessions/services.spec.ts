import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockSend = vi.fn()
const mockGet = vi.fn(() => ({ send: mockSend }))
vi.mock('@/utils/server', () => ({
  alovaInstance: {
    Get: mockGet,
  },
}))

import { fetchSession, fetchSessionMessages, fetchSessions } from '@/features/sessions/services'

describe('sessions services', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetchSessions falls back to mock on error', async () => {
    mockSend.mockRejectedValueOnce(new Error('offline'))
    const r = await fetchSessions()
    expect(r.total).toBeGreaterThan(0)
    expect(r.items.length).toBeGreaterThan(0)
    for (const s of r.items) {
      expect(['active', 'archived', 'stopped']).toContain(s.status)
    }
  })

  it('fetchSessions returns real data on success', async () => {
    const fake = { items: [], total: 0 }
    mockSend.mockResolvedValueOnce(fake)
    expect(await fetchSessions({ page: 1 })).toEqual(fake)
  })

  it('fetchSessionMessages falls back to mock on error', async () => {
    mockSend.mockRejectedValueOnce(new Error('offline'))
    const r = await fetchSessionMessages('s1')
    expect(r.length).toBeGreaterThan(0)
    for (const m of r) {
      expect(['user', 'assistant', 'system']).toContain(m.role)
    }
  })

  it('fetchSession returns null when not found', async () => {
    mockSend.mockRejectedValueOnce(new Error('offline'))
    const r = await fetchSession('nonexistent')
    expect(r).toBeNull()
  })

  it('fetchSession returns mock when id matches', async () => {
    mockSend.mockRejectedValueOnce(new Error('offline'))
    const r = await fetchSession('s1')
    expect(r?.id).toBe('s1')
  })
})
