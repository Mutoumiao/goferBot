import { rateLimiter } from 'hono-rate-limiter'
import type { MiddlewareHandler } from 'hono'

function createAuthRateLimit(windowMs: number, limit: number): MiddlewareHandler {
  return rateLimiter({
    windowMs,
    limit,
    keyGenerator: (c) => c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? 'unknown',
    handler: (c) => {
      c.header('Retry-After', String(Math.ceil(windowMs / 1000)))
      c.header('X-RateLimit-Limit', String(limit))
      c.header('X-RateLimit-Remaining', '0')
      return c.json({ error: 'Too many requests, please try again later' }, 429)
    },
  }) as MiddlewareHandler
}

/** 登录端点限速：5 次/分钟/IP */
export const signInRateLimit = createAuthRateLimit(60 * 1000, 5)

/** 注册端点限速：5 次/分钟/IP */
export const signUpRateLimit = createAuthRateLimit(60 * 1000, 5)

/** 登出端点限速：20 次/分钟/IP */
export const signOutRateLimit = createAuthRateLimit(60 * 1000, 20)

/** 会话查询端点限速：60 次/分钟/IP */
export const sessionRateLimit = createAuthRateLimit(60 * 1000, 60)
