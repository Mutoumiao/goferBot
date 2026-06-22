import { describe, expect, it } from 'vitest'
import { mapErrorMessage, isConflict, isForbidden } from '@/utils/error-mapper'

describe('error-mapper', () => {
  it('maps known codes', () => {
    expect(mapErrorMessage({ code: 'AUTH_FAIL' })).toBe('账号或密码错误')
    expect(mapErrorMessage({ code: 'FORBIDDEN' })).toBe('无权限访问')
    expect(mapErrorMessage({ code: 'USER_NOT_FOUND' })).toBe('用户不存在')
  })

  it('maps HTTP status codes', () => {
    expect(mapErrorMessage({ status: 401 })).toBe('登录已过期，请重新登录')
    expect(mapErrorMessage({ status: 403 })).toBe('无权限访问')
    expect(mapErrorMessage({ status: 409 })).toBe('数据已被他人修改，请刷新后重试')
    expect(mapErrorMessage({ status: 429 })).toBe('操作过于频繁，请稍后再试')
    expect(mapErrorMessage({ status: 500 })).toBe('系统繁忙，请稍后再试')
  })

  it('returns generic message for unknown', () => {
    expect(mapErrorMessage({})).toMatch(/操作失败/)
    expect(mapErrorMessage(new Error('boom'))).toBe('boom')
  })

  it('detects conflict & forbidden', () => {
    expect(isConflict({ status: 409 })).toBe(true)
    expect(isConflict({ code: 'CONFLICT' })).toBe(true)
    expect(isConflict({ status: 200 })).toBe(false)
    expect(isForbidden({ status: 403 })).toBe(true)
  })
})
