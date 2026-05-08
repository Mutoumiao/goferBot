import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  sidecarStatus,
  sidecarPort,
  sidecarError,
  initSidecar,
  retrySidecar,
  _resetSidecarStateForTest,
} from '@/composables/useSidecar'
import * as tauriApi from '@tauri-apps/api/core'
import * as tauriEvent from '@tauri-apps/api/event'

vi.mock('@tauri-apps/api/core')
vi.mock('@tauri-apps/api/event')

describe('useSidecar', () => {
  let readyCallback: ((payload: { port: number }) => void) | null = null
  let restartedCallback: ((payload: { port: number }) => void) | null = null

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    _resetSidecarStateForTest()

    vi.mocked(tauriEvent.listen).mockImplementation(async (event, cb) => {
      if (event === 'sidecar-ready') {
        readyCallback = (payload: { port: number }) => {
          (cb as unknown as (e: { payload: { port: number } }) => void)({ payload })
        }
      }
      if (event === 'sidecar-restarted') {
        restartedCallback = (payload: { port: number }) => {
          (cb as unknown as (e: { payload: { port: number } }) => void)({ payload })
        }
      }
      return () => {}
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    readyCallback = null
    restartedCallback = null
  })

  it('should set ready when port is immediately available via invoke', async () => {
    vi.mocked(tauriApi.invoke).mockResolvedValue(11451)
    await initSidecar()
    expect(sidecarStatus.value).toBe('ready')
    expect(sidecarPort.value).toBe(11451)
  })

  it('should remain loading until event fires', async () => {
    vi.mocked(tauriApi.invoke).mockRejectedValue(new Error('not ready'))
    await initSidecar()
    expect(sidecarStatus.value).toBe('loading')
  })

  it('should set error after 30s timeout', async () => {
    vi.mocked(tauriApi.invoke).mockRejectedValue(new Error('not ready'))
    await initSidecar()
    expect(sidecarStatus.value).toBe('loading')
    await vi.advanceTimersByTimeAsync(30000)
    expect(sidecarStatus.value).toBe('error')
    expect(sidecarError.value).toContain('超时')
  })

  it('should update to ready on sidecar-ready event', async () => {
    vi.mocked(tauriApi.invoke).mockRejectedValue(new Error('not ready'))
    await initSidecar()
    readyCallback?.({ port: 11452 })
    expect(sidecarStatus.value).toBe('ready')
    expect(sidecarPort.value).toBe(11452)
  })

  it('should update port on sidecar-restarted event', async () => {
    vi.mocked(tauriApi.invoke).mockRejectedValue(new Error('not ready'))
    await initSidecar()
    expect(sidecarStatus.value).toBe('loading')
    readyCallback?.({ port: 11451 })
    expect(sidecarPort.value).toBe(11451)
    restartedCallback?.({ port: 11453 })
    expect(sidecarStatus.value).toBe('ready')
    expect(sidecarPort.value).toBe(11453)
  })

  it('should clear timeout when event arrives before 30s', async () => {
    vi.mocked(tauriApi.invoke).mockRejectedValue(new Error('not ready'))
    await initSidecar()
    await vi.advanceTimersByTimeAsync(15000)
    readyCallback?.({ port: 11452 })
    expect(sidecarStatus.value).toBe('ready')
    await vi.advanceTimersByTimeAsync(20000)
    expect(sidecarStatus.value).toBe('ready')
    expect(sidecarError.value).toBe('')
  })

  it('retrySidecar should call restart_sidecar and reset to loading', async () => {
    vi.mocked(tauriApi.invoke).mockResolvedValue(11451)
    await initSidecar()
    sidecarStatus.value = 'error'
    vi.mocked(tauriApi.invoke).mockClear()
    vi.mocked(tauriApi.invoke).mockResolvedValue(undefined)
    await retrySidecar()
    expect(tauriApi.invoke).toHaveBeenCalledWith('restart_sidecar')
    expect(sidecarStatus.value).toBe('loading')
  })

  it('should be idempotent when initSidecar is called multiple times', async () => {
    vi.mocked(tauriApi.invoke).mockResolvedValue(11451)
    await initSidecar()
    expect(sidecarStatus.value).toBe('ready')
    expect(sidecarPort.value).toBe(11451)

    // Clear mock to track only calls from second initSidecar
    vi.mocked(tauriApi.invoke).mockClear()
    await initSidecar()
    // Second call should not re-execute; port stays at first value
    expect(sidecarPort.value).toBe(11451)
    expect(vi.mocked(tauriApi.invoke)).not.toHaveBeenCalled()
  })

  it('should set error when listen throws permission error', async () => {
    vi.mocked(tauriApi.invoke).mockRejectedValue(new Error('not ready'))
    vi.mocked(tauriEvent.listen).mockRejectedValue(new Error('permission denied'))

    await initSidecar()

    expect(sidecarStatus.value).toBe('error')
    expect(sidecarError.value).toContain('权限')
  })
})
