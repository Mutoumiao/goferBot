import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TraceContextService } from '@/common/services/trace-context.service.js'
import { RequestContextStorage } from '@/common/request-context-storage.js'

describe('TraceContextService', () => {
  const service = new TraceContextService()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns "no-trace" when no request context exists', () => {
    expect(service.current()).toBe('no-trace')
    expect(service.currentRequestId()).toBe('no-request-id')
  })

  it('returns traceId from current request context', () => {
    RequestContextStorage.run({
      ip: '127.0.0.1',
      userAgent: 'test',
      requestId: 'req-1',
      traceId: 'trace-abc',
    }, () => {
      expect(service.current()).toBe('trace-abc')
      expect(service.currentRequestId()).toBe('req-1')
    })
  })

  it('returns email when present in request context', () => {
    RequestContextStorage.run({
      ip: '127.0.0.1',
      userAgent: 'test',
      requestId: 'req-1',
      traceId: 'trace-abc',
      email: 'user@example.com',
    }, () => {
      expect(service.currentEmail()).toBe('user@example.com')
    })
  })

  it('returns undefined for email when not set', () => {
    RequestContextStorage.run({
      ip: '127.0.0.1',
      userAgent: 'test',
      requestId: 'req-1',
      traceId: 'trace-abc',
    }, () => {
      expect(service.currentEmail()).toBeUndefined()
    })
  })
})
