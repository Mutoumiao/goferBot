import { describe, expect, it } from 'vitest'
import { RequestContextStorage } from '@/common/request-context-storage.js'
import { withTrace } from '@/common/utils/with-trace.js'

describe('withTrace', () => {
  it('prefixes message with no-trace when no context', () => {
    expect(withTrace('hello')).toBe('[trace:no-trace] [req:no-request-id] hello')
  })

  it('prefixes message with trace from AsyncLocalStorage', () => {
    RequestContextStorage.run(
      {
        ip: '127.0.0.1',
        userAgent: 'test',
        requestId: 'req-123',
        traceId: 'trace-abc',
      },
      () => {
        expect(withTrace('hello')).toBe('[trace:trace-abc] [req:req-123] hello')
      },
    )
  })

  it('appends meta fields as key=value pairs', () => {
    RequestContextStorage.run(
      {
        ip: '127.0.0.1',
        userAgent: 'test',
        requestId: 'req-1',
        traceId: 'trace-xyz',
      },
      () => {
        const result = withTrace('saved', { userId: 'u1', count: 3 })
        expect(result).toContain('[trace:trace-xyz]')
        expect(result).toContain('userId=u1')
        expect(result).toContain('count=3')
        expect(result).toContain('saved')
      },
    )
  })
})
