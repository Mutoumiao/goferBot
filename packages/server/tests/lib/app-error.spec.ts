import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppException } from '@/lib/app-error.js'

describe('AppException', () => {
  it('creates exception with code and message', () => {
    const ex = new AppException('TEST_CODE', '测试错误', 400)

    expect(ex.code).toBe('TEST_CODE')
    expect(ex.getStatus()).toBe(400)
    const response = ex.getResponse() as { error: { message: string } }
    expect(response.error.message).toBe('测试错误')
  })

  it('includes details when provided', () => {
    const ex = new AppException('VALIDATION_ERROR', '验证失败', 422, { field: 'email' })

    expect(ex.details).toEqual({ field: 'email' })
  })

  it('defaults to status 500', () => {
    const ex = new AppException('INTERNAL', '内部错误')

    expect(ex.getStatus()).toBe(500)
  })
})
