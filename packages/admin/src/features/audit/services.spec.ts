import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fetchAuditLogs, exportAuditLogs } from '@/features/audit/services'
import { toast } from 'sonner'

const { mockFetch, mockExport } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
  mockExport: vi.fn(),
}))

vi.mock('@/api/audit', () => ({
  fetchAuditLogs: () => ({ send: () => mockFetch() }),
  exportAuditLogs: () => ({ send: () => mockExport() }),
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

describe('audit services', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetchAuditLogs returns real data on success', async () => {
    const fake = { items: [{ id: 'a1' }], total: 1 }
    mockFetch.mockResolvedValueOnce(fake)
    expect(await fetchAuditLogs()).toEqual(fake)
  })

  it('fetchAuditLogs returns empty on error with toast', async () => {
    mockFetch.mockRejectedValueOnce(new Error('offline'))
    const r = await fetchAuditLogs()
    expect(r.items).toEqual([])
    expect(r.total).toBe(0)
    expect(toast.error).toHaveBeenCalled()
  })

  it('exportAuditLogs forwards blob on success', async () => {
    const fake = new Blob(['x'])
    mockExport.mockResolvedValueOnce(fake)
    expect(await exportAuditLogs()).toBe(fake)
  })

  it('exportAuditLogs rethrows on error', async () => {
    mockExport.mockRejectedValueOnce(new Error('boom'))
    await expect(exportAuditLogs()).rejects.toThrow()
    expect(toast.error).toHaveBeenCalled()
  })
})
