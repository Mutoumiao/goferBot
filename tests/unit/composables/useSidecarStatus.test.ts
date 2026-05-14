import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import {
  sidecarStatus,
  sidecarPort,
  sidecarError,
  initSidecarStatus,
  retrySidecarStatus,
  _resetSidecarStatusForTest,
} from '@/composables/useSidecarStatus'
import { setShell } from '@goferbot/shell-adapters'
import { MemoryShell } from '@goferbot/shell-adapters'

describe('useSidecarStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    _resetSidecarStatusForTest()
    setShell(null)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    setShell(null)
  })

  it('should set ready when port is immediately available', async () => {
    const shell = new MemoryShell({ initialPort: 11451 })
    setShell(shell)
    await initSidecarStatus()
    expect(sidecarStatus.value).toBe('ready')
    expect(sidecarPort.value).toBe(11451)
  })

  it('should remain loading until event fires', async () => {
    const shell = new MemoryShell()
    setShell(shell)
    const done = initSidecarStatus()
    await flushPromises()
    expect(sidecarStatus.value).toBe('loading')
    shell.triggerReady(11499)
    await done
    expect(sidecarStatus.value).toBe('ready')
    expect(sidecarPort.value).toBe(11499)
  })

  it('should set error after 30s timeout', async () => {
    const shell = new MemoryShell()
    setShell(shell)
    const done = initSidecarStatus()
    await flushPromises()
    expect(sidecarStatus.value).toBe('loading')
    await vi.advanceTimersByTimeAsync(30000)
    await done
    expect(sidecarStatus.value).toBe('error')
    expect(sidecarError.value).toContain('超时')
  })

  it('should update port on sidecar-restarted event', async () => {
    const shell = new MemoryShell()
    setShell(shell)
    const done = initSidecarStatus()
    await flushPromises()
    shell.triggerReady(11451)
    await done
    expect(sidecarStatus.value).toBe('ready')
    expect(sidecarPort.value).toBe(11451)

    shell.triggerRestarted(11453)
    expect(sidecarStatus.value).toBe('ready')
    expect(sidecarPort.value).toBe(11453)
  })

  it('retrySidecarStatus should call restartSidecar and reset to loading', async () => {
    const shell = new MemoryShell({ initialPort: 11451 })
    setShell(shell)
    await initSidecarStatus()
    sidecarStatus.value = 'error'

    await retrySidecarStatus()
    expect(shell.wasRestartCalled()).toBe(true)
    expect(sidecarStatus.value).toBe('loading')
  })

  it('should be idempotent when initSidecarStatus is called multiple times', async () => {
    const shell = new MemoryShell({ initialPort: 11451 })
    setShell(shell)
    await initSidecarStatus()
    expect(sidecarStatus.value).toBe('ready')
    expect(sidecarPort.value).toBe(11451)

    await initSidecarStatus()
    expect(sidecarPort.value).toBe(11451)
  })
})
