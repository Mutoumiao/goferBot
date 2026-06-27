import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkerService } from '@/processors/queue/worker.service.js'

interface CapturedWorkerOpts {
  concurrency: number
  connection: unknown
}

const captured = {
  document: undefined as CapturedWorkerOpts | undefined,
  embedding: undefined as CapturedWorkerOpts | undefined,
}

vi.mock('bullmq', () => ({
  Worker: vi
    .fn()
    .mockImplementation((queueName: string, _processor: unknown, opts: CapturedWorkerOpts) => {
      if (queueName === 'document-processing') {
        captured.document = opts
        return { on: vi.fn() }
      }
      if (queueName === 'embedding') {
        captured.embedding = opts
        return { on: vi.fn() }
      }
      return { on: vi.fn() }
    }),
}))

describe('WorkerService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    captured.document = undefined
    captured.embedding = undefined
  })

  function createService(concurrencyValue: string | undefined) {
    const mockConfig = {
      get: vi.fn((key: string, defaultValue?: unknown) => {
        if (key === 'QUEUE_CONCURRENCY') return concurrencyValue ?? defaultValue
        return defaultValue
      }),
    }
    const mockPrisma = { document: { update: vi.fn() } }
    const handler = vi.fn()
    const service = new WorkerService(mockConfig as any, mockPrisma as any, handler, handler)
    return { service, mockConfig }
  }

  it('AC-01: parses numeric QUEUE_CONCURRENCY string into finite number', () => {
    const { service } = createService('3')
    service.startWorkers({} as any)
    expect(captured.document?.concurrency).toBe(3)
    expect(captured.embedding?.concurrency).toBe(3)
  })

  it('AC-02: defaults to 2 when QUEUE_CONCURRENCY is undefined', () => {
    const { service } = createService(undefined)
    service.startWorkers({} as any)
    expect(captured.document?.concurrency).toBe(2)
    expect(captured.embedding?.concurrency).toBe(2)
  })

  it('AC-03: defaults to 2 when QUEUE_CONCURRENCY is empty', () => {
    const { service } = createService('')
    service.startWorkers({} as any)
    expect(captured.document?.concurrency).toBe(2)
    expect(captured.embedding?.concurrency).toBe(2)
  })

  it('AC-04: defaults to 2 when QUEUE_CONCURRENCY is non-numeric', () => {
    const { service } = createService('not-a-number')
    service.startWorkers({} as any)
    expect(captured.document?.concurrency).toBe(2)
    expect(captured.embedding?.concurrency).toBe(2)
  })

  it('AC-05: falls back to default 2 when QUEUE_CONCURRENCY is non-positive', () => {
    const { service } = createService('0')
    service.startWorkers({} as any)
    expect(captured.document?.concurrency).toBe(2)
    expect(captured.embedding?.concurrency).toBe(2)
  })
})
