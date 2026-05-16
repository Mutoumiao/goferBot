import type { Hono } from 'hono'

const isProd = process.env.NODE_ENV === 'production'

/**
 * 手动设置 HTTP 安全响应头。
 * 不使用 helmet 包，避免与 Hono 的兼容性问题和 CSP 默认策略干扰 API 响应。
 */
export function applyHelmet(app: Hono): void {
  app.use('*', async (c, next) => {
    c.header('X-Content-Type-Options', 'nosniff')
    c.header('X-Frame-Options', 'DENY')
    c.header('X-XSS-Protection', '1; mode=block')
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin')

    if (isProd) {
      c.header('Strict-Transport-Security', 'max-age=63072000; includeSubDomains')
    }

    await next()
  })
}
