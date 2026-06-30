/**
 * 统一错误码映射 —— 把后端返回的 code 映射为中文提示。
 * 单点维护，UI 层只消费映射结果。
 */
export const ERROR_CODE_MAP: Record<string, string> = {
  AUTH_FAIL: '账号或密码错误',
  USER_EXISTS: '该邮箱已被注册',
  USER_NOT_FOUND: '用户不存在',
  ACCOUNT_DISABLED: '账号已被禁用',
  INVALID_REFRESH_TOKEN: '登录已过期，请重新登录',
  FORBIDDEN: '无权限访问',
  UNAUTHORIZED: '请先登录',
  VALIDATION_ERROR: '输入信息不符合要求',
  DECRYPT_FAILED: '加密密钥已过期，请刷新页面后重试',
  CONFLICT: '数据已被他人修改，请刷新后重试',
  RATE_LIMITED: '操作过于频繁，请稍后再试',
}

// Security: Sanitize error messages to prevent XSS
function sanitizeErrorMessage(message: string): string {
  return message
    .replace(/[<>'"&`\\]/g, '')
    .replace(/<[^>]*>/g, '')
    .trim()
}

export interface MappedError extends Error {
  status?: number
  code?: string
  cause?: unknown
}

export function mapErrorMessage(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as MappedError
    const code = e.code
    if (code && ERROR_CODE_MAP[code]) return sanitizeErrorMessage(ERROR_CODE_MAP[code])

    if (e.status === 401) return sanitizeErrorMessage('登录已过期，请重新登录')
    if (e.status === 403) return sanitizeErrorMessage('无权限访问')
    if (e.status === 404) return sanitizeErrorMessage('请求的资源不存在')
    if (e.status === 409) return sanitizeErrorMessage('数据已被他人修改，请刷新后重试')
    if (e.status === 429) return sanitizeErrorMessage('操作过于频繁，请稍后再试')
    if (e.status === 500) return sanitizeErrorMessage('系统繁忙，请稍后再试')

    const message = e.message
    if (message && typeof message === 'string' && message.length <= 80)
      return sanitizeErrorMessage(message)
  }

  if (err instanceof Error) return sanitizeErrorMessage(err.message || '操作失败，请稍后重试')

  return sanitizeErrorMessage('操作失败，请稍后重试')
}

export function isConflict(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as MappedError
  return e.status === 409 || e.code === 'CONFLICT'
}

export function isForbidden(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as MappedError
  return e.status === 403 || e.code === 'FORBIDDEN'
}
