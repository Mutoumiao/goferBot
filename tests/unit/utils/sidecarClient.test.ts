import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  sidecarFetch,
  setSidecarPort,
  getSidecarPort,
  clearSidecarPort,
  healthCheck,
} from '@/utils/sidecarClient'

describe('sidecarClient', () => {
  beforeEach(() => {
    setSidecarPort(11451)
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('getSidecarPort returns current port', () => {
    expect(getSidecarPort()).toBe(11451)
  })

  it('should throw when port is not set', async () => {
    clearSidecarPort()
    await expect(sidecarFetch('/test')).rejects.toThrow('Sidecar port not available')
  })

  it('should fetch from correct URL', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    } as Response)

    await sidecarFetch('/health')
    expect(global.fetch).toHaveBeenCalledWith('http://127.0.0.1:11451/health', {})
  })

  it('should retry on failure and eventually succeed', async () => {
    global.fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ ok: true } as Response)

    const promise = sidecarFetch('/test', {}, 3)
    await vi.runAllTimersAsync()
    const result = await promise

    expect(global.fetch).toHaveBeenCalledTimes(2)
    expect(result.ok).toBe(true)
  })

  it('should return last response when all retries exhausted', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response)

    const result = await sidecarFetch('/test', {}, 1)
    expect(global.fetch).toHaveBeenCalledTimes(2)
    expect(result.ok).toBe(false)
  })

  it('healthCheck returns true when sidecar responds', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true } as Response)
    const result = await healthCheck()
    expect(result).toBe(true)
  })

  it('healthCheck returns false when port is unset', async () => {
    clearSidecarPort()
    const result = await healthCheck()
    expect(result).toBe(false)
  })
})
