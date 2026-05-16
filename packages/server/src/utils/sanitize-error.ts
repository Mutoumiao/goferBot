import type { ErrorHandler } from 'hono'
import { ZodError } from 'zod'
import { SSRFError } from './ssrf-guard.js'
import { AuthError, ValidationError, NotFoundError, ConflictError } from '../interfaces/errors.js'

const isProd = process.env.NODE_ENV === 'production'

interface ErrorResponse {
  error: {
    code: string
    message: string
    details?: Array<{ field: string; issue: string }>
  }
}

export const sanitizeError: ErrorHandler = (err, c) => {
  console.error('[Server Error]', err)

  let status = 500
  let response: ErrorResponse = {
    error: {
      code: 'INTERNAL_ERROR',
      message: '服务器内部错误',
    },
  }

  if (err instanceof ZodError) {
    status = 400
    response = {
      error: {
        code: 'VALIDATION_ERROR',
        message: '请求参数校验失败',
        details: isProd
          ? undefined
          : err.issues.map(i => ({ field: i.path.join('.'), issue: i.message })),
      },
    }
  } else if (err instanceof SSRFError) {
    status = 400
    response = {
      error: {
        code: 'SSRF_BLOCKED',
        message: '不合法的 API 地址',
      },
    }
  } else if (err instanceof AuthError) {
    status = 401
    response = {
      error: {
        code: 'AUTH_ERROR',
        message: err.message || '认证失败',
      },
    }
  } else if (err instanceof ValidationError) {
    status = 400
    response = {
      error: {
        code: 'VALIDATION_ERROR',
        message: err.message || '请求参数校验失败',
      },
    }
  } else if (err instanceof NotFoundError) {
    status = 404
    response = {
      error: {
        code: 'NOT_FOUND',
        message: err.message || '资源不存在',
      },
    }
  } else if (err instanceof ConflictError) {
    status = 409
    response = {
      error: {
        code: 'CONFLICT',
        message: err.message || '资源冲突',
      },
    }
  }

  // 生产环境绝不暴露堆栈或原始错误信息
  if (!isProd && status === 500 && err instanceof Error) {
    response.error.message = err.message
  }

  return c.json(response, status as any)
}
