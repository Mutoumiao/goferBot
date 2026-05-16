import { zValidator } from '@hono/zod-validator'
import type { ZodSchema } from 'zod'
import type { MiddlewareHandler } from 'hono'

const isProd = process.env.NODE_ENV === 'production'

export function validateBody<T extends ZodSchema>(schema: T): MiddlewareHandler {
  return zValidator('json', schema, (result, c) => {
    if (!result.success) {
      return c.json({
        error: {
          code: 'VALIDATION_ERROR',
          message: '请求参数校验失败',
          details: isProd
            ? undefined
            : result.error.issues.map(i => ({ field: i.path.join('.'), issue: i.message })),
        },
      }, 400)
    }
  })
}
