import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HealthService } from '@/modules/health/health.service.js'

function createMockPrisma() {
  return { $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]) } as any
}

function createMockAuthRedis(overrides: Record<string, unknown> = {}) {
  return {
    ping: vi.fn().mockResolvedValue('PONG'),
    ...overrides,
  } as any
}

function createMockStorage(overrides: Record<string, unknown> = {}) {
  return { bucketExists: vi.fn().mockResolvedValue(true), ...overrides } as any
}

function createService(overrides: {
  prisma?: unknown
  auth?: Record<string, unknown>
  storage?: Record<string, unknown>
}) {
  return new HealthService(
    (overrides.prisma ?? createMockPrisma()) as any,
    createMockAuthRedis(overrides.auth),
    createMockStorage(overrides.storage),
  )
}

describe('HealthService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns ok when all probes pass', async () => {
    const service = createService({})
    const snap = await service.check()
    expect(snap.status).toBe('ok')
    expect(snap.components.map((c) => c.name)).toEqual(['postgres', 'redis', 'minio'])
    expect(snap.components.every((c) => c.status === 'ok')).toBe(true)
  })

  it('returns down when a probe throws', async () => {
    const service = createService({
      storage: { bucketExists: vi.fn().mockRejectedValue(new Error('no bucket')) },
    })
    const snap = await service.check()
    expect(snap.status).toBe('down')
    expect(snap.components.find((c) => c.name === 'minio')?.status).toBe('down')
  })

  it('returns degraded when redis is skipped (not enabled)', async () => {
    const service = createService({
      auth: { ping: vi.fn().mockResolvedValue('skipped') },
    })
    const snap = await service.check()
    expect(snap.status).toBe('degraded')
    expect(snap.components.find((c) => c.name === 'redis')?.status).toBe('degraded')
  })

  it('returns degraded when a probe times out', async () => {
    const service = createService({
      prisma: {
        $queryRaw: vi
          .fn()
          .mockImplementation(
            () =>
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error('probe timed out after 2500ms')), 10),
              ),
          ),
      },
    })
    const snap = await service.check()
    expect(snap.components.find((c) => c.name === 'postgres')?.status).toBe('degraded')
  })

  it('does not expose internal error details in the HTTP-ready snapshot', async () => {
    const service = createService({
      storage: { bucketExists: vi.fn().mockRejectedValue(new Error('secret-internal-detail')) },
    })
    const snap = await service.check()
    // error 字段已从最终 HTTP 响应中剥离
    for (const c of snap.components) {
      expect((c as unknown as Record<string, unknown>).error).toBeUndefined()
    }
  })

  it('tags latency per component', async () => {
    const service = createService({})
    const snap = await service.check()
    for (const c of snap.components) {
      expect(c.latencyMs).toBeGreaterThanOrEqual(0)
    }
  })
})
