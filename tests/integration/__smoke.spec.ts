import { describe, it, expect } from 'vitest'
import { startSidecar, stopSidecar } from './setup'

describe('sidecar setup', () => {
  it('starts and stops', async () => {
    const { port, dataDir } = await startSidecar()
    expect(typeof port).toBe('number')
    expect(port).toBeGreaterThan(0)
    expect(typeof dataDir).toBe('string')
    await stopSidecar()
  })
})
