import { describe, it, expect, vi } from 'vitest'
import { MemoryShell } from '@/shell/memory'

describe('MemoryShell', () => {
  it('returns initial port', async () => {
    const shell = new MemoryShell({ initialPort: 11451 })
    expect(await shell.getSidecarPort()).toBe(11451)
  })

  it('returns null when no port set', async () => {
    const shell = new MemoryShell()
    expect(await shell.getSidecarPort()).toBeNull()
  })

  it('triggers ready event', async () => {
    const shell = new MemoryShell()
    const handler = vi.fn()
    await shell.onSidecarReady(handler)
    shell.triggerReady(11452)
    expect(handler).toHaveBeenCalledWith({ port: 11452 })
  })

  it('triggers restarted event', async () => {
    const shell = new MemoryShell()
    const handler = vi.fn()
    await shell.onSidecarRestarted(handler)
    shell.triggerRestarted(11453)
    expect(handler).toHaveBeenCalledWith({ port: 11453 })
  })

  it('unlisten removes handler', async () => {
    const shell = new MemoryShell()
    const handler = vi.fn()
    const unlisten = await shell.onSidecarReady(handler)
    unlisten()
    shell.triggerReady(11452)
    expect(handler).not.toHaveBeenCalled()
  })

  it('tracks restart calls', async () => {
    const shell = new MemoryShell()
    expect(shell.wasRestartCalled()).toBe(false)
    await shell.restartSidecar()
    expect(shell.wasRestartCalled()).toBe(true)
  })

  it('tracks import calls', async () => {
    const shell = new MemoryShell()
    await shell.importFiles('kb1', 'docs/')
    expect(shell.getImportCalls()).toEqual([{ knowledgeBaseId: 'kb1', targetPath: 'docs/' }])
  })

  it('auto triggers ready when configured', async () => {
    const handler = vi.fn()
    const shell = new MemoryShell({ initialPort: 11451, autoTriggerReady: true })
    await shell.onSidecarReady(handler)
    await vi.waitFor(() => expect(handler).toHaveBeenCalledWith({ port: 11451 }))
  })
})
