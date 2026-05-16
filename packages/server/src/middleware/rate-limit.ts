import { rateLimiter } from 'hono-rate-limiter'
import type { MiddlewareHandler } from 'hono'

function getClientIp(c: { req: { header: (name: string) => string | undefined } }): string {
  return c.req.header('x-forwarded-for')
    ?? c.req.header('x-real-ip')
    ?? 'unknown'
}

function createRateLimit(windowMs: number, limit: number, keySuffix: string): MiddlewareHandler {
  return rateLimiter({
    windowMs,
    limit,
    keyGenerator: (c) => `${getClientIp(c)}:${keySuffix}`,
    handler: (c) => {
      const retryAfter = Math.ceil(windowMs / 1000)
      c.header('Retry-After', String(retryAfter))
      c.header('X-RateLimit-Limit', String(limit))
      c.header('X-RateLimit-Remaining', '0')
      return c.json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: '请求过于频繁，请稍后再试',
        },
      }, 429)
    },
  }) as MiddlewareHandler
}

/** 认证端点限速：5 次/分钟/IP */
export const authRateLimit = createRateLimit(60_000, 5, 'auth')

/** 聊天端点限速：10 次/分钟/IP */
export const chatRateLimit = createRateLimit(60_000, 10, 'chat')

/** 文件上传端点限速：30 次/分钟/IP */
export const uploadRateLimit = createRateLimit(60_000, 30, 'upload')

/** 通用端点限速：60 次/分钟/IP */
export const generalRateLimit = createRateLimit(60_000, 60, 'general')
