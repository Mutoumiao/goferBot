import type { CallHandler, ExecutionContext } from '@nestjs/common'
import { of, timer } from 'rxjs'
import { map } from 'rxjs/operators'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LoggingInterceptor } from '../../src/common/interceptors/logging.interceptor.js'

function createMockContext(
  method: string,
  url: string,
  statusCode: number,
  _duration: number,
): { context: ExecutionContext; handler: CallHandler } {
  const request = { method, url, ip: '127.0.0.1', requestId: 'req-1', traceId: 'trace-1' }
  const response = { statusCode }

  const context: ExecutionContext = {
    getClass: () => class {},
    getHandler: () => () => {},
    getArgs: () => [],
    getArgByIndex: () => undefined,
    switchToHttp: () => ({
      getRequest: /* pony: mock */ () => request,
      getResponse: /* pony: mock */ () => response,
    }),
    getType: () => 'http' as const,
  } as unknown as ExecutionContext

  const handler: CallHandler = {
    handle: () => (_duration > 0 ? timer(_duration).pipe(map(() => ({}))) : of({})),
  }

  return { context, handler }
}

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor
  let originalEnv: string | undefined

  beforeEach(() => {
    originalEnv = process.env.NODE_ENV
    interceptor = new LoggingInterceptor()
    vi.useFakeTimers()
  })

  afterEach(() => {
    process.env.NODE_ENV = originalEnv
    vi.useRealTimers()
  })

  describe('sanitizeUrl', () => {
    it('masks token parameter', () => {
      const interceptor = new LoggingInterceptor()
      const result = (interceptor as any).sanitizeUrl('/api/chat?token=abc123&id=1')
      expect(result).toBe('/api/chat?token=***&id=1')
    })

    it('masks password parameter', () => {
      const interceptor = new LoggingInterceptor()
      const result = (interceptor as any).sanitizeUrl('/api/login?password=secret')
      expect(result).toBe('/api/login?password=***')
    })

    it('does not modify safe parameters', () => {
      const interceptor = new LoggingInterceptor()
      const result = (interceptor as any).sanitizeUrl('/api/users?id=1&name=test')
      expect(result).toBe('/api/users?id=1&name=test')
    })
  })

  describe('production mode', () => {
    it('logs errors with error level', async () => {
      process.env.NODE_ENV = 'production'
      const interceptor = new LoggingInterceptor()
      const loggerSpy = vi.spyOn((interceptor as any).logger, 'error')

      const { context, handler } = createMockContext('GET', '/api/test', 500, 0)

      const result = interceptor.intercept(context, handler)
      result.subscribe()

      await vi.advanceTimersByTimeAsync(10)

      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('ERROR: GET'))
    })

    it('logs slow requests with log level', async () => {
      process.env.NODE_ENV = 'production'
      process.env.LOG_REQUEST_SLOW_THRESHOLD_MS = '100'
      const interceptor = new LoggingInterceptor()
      const loggerSpy = vi.spyOn((interceptor as any).logger, 'log')

      const { context, handler } = createMockContext('GET', '/api/slow', 200, 200)

      const result = interceptor.intercept(context, handler)
      result.subscribe()

      await vi.advanceTimersByTimeAsync(300)

      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('SLOW: GET'))
    })
  })

  describe('development mode', () => {
    it('logs all requests with debug level', async () => {
      process.env.NODE_ENV = 'development'
      const interceptor = new LoggingInterceptor()
      const loggerSpy = vi.spyOn((interceptor as any).logger, 'debug')

      const { context, handler } = createMockContext('GET', '/api/test', 200, 0)

      const result = interceptor.intercept(context, handler)
      result.subscribe()

      await vi.advanceTimersByTimeAsync(10)

      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('--- Response: GET'))
    })
  })
})
