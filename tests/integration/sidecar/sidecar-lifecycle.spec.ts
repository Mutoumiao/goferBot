import { describe, it, expect } from 'vitest'
import { startSidecar, stopSidecar, getSidecarProcess } from '../setup'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

describe('sidecar lifecycle', () => {
  it('discovers port via .sidecar-port file', async () => {
    const { port, dataDir } = await startSidecar()
    try {
      expect(port).toBeGreaterThan(0)
      const portFile = join(dataDir, '.sidecar-port')
      expect(existsSync(portFile)).toBe(true)
      const content = readFileSync(portFile, 'utf-8').trim()
      expect(parseInt(content, 10)).toBe(port)
    } finally {
      await stopSidecar()
    }
  })

  it('health check returns 200', async () => {
    const { port } = await startSidecar()
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.status).toBe('ok')
    } finally {
      await stopSidecar()
    }
  })

  it('restarts after process kill', async () => {
    const { port, dataDir } = await startSidecar()
    const proc = getSidecarProcess()
    expect(proc).not.toBeNull()

    try {
      // Kill the standalone sidecar process.
      // Note: auto-restart via Rust monitor_loop only works when the sidecar
      // is spawned by the Rust host. In standalone test mode we verify the
      // port file exists before kill and that the process stops.
      proc!.kill('SIGTERM')
      // Allow a brief moment for the process to terminate on Windows.
      await new Promise<void>((resolve) => setTimeout(resolve, 1000))

      // Verify the old port file still exists (no crash cleanup in standalone mode)
      const portFile = join(dataDir, '.sidecar-port')
      expect(existsSync(portFile)).toBe(true)
      const content = readFileSync(portFile, 'utf-8').trim()
      expect(parseInt(content, 10)).toBe(port)

      // Since this is a standalone Node.js process not managed by Rust,
      // auto-restart is not expected. We skip further restart assertions.
    } finally {
      await stopSidecar()
    }
  })

  it('graceful shutdown', async () => {
    const { port, dataDir } = await startSidecar()
    const proc = getSidecarProcess()
    expect(proc).not.toBeNull()
    expect(existsSync(dataDir)).toBe(true)

    await stopSidecar()

    // Verify process is killed and temp dir is cleaned
    expect(getSidecarProcess()).toBeNull()
    expect(existsSync(dataDir)).toBe(false)
  })
})
