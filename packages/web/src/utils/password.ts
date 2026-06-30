export const PASSWORD_POLICY = {
  minLength: 8,
  requireMixedCase: true,
  requireDigit: true,
} as const

export function validatePassword(password: string): string | null {
  if (!password) return '请输入密码'
  if (password.length < PASSWORD_POLICY.minLength) {
    return `密码长度至少 ${PASSWORD_POLICY.minLength} 位`
  }
  if (PASSWORD_POLICY.requireMixedCase && !/[a-z]/.test(password)) {
    return '密码必须包含小写字母'
  }
  if (PASSWORD_POLICY.requireMixedCase && !/[A-Z]/.test(password)) {
    return '密码必须包含大写字母'
  }
  if (PASSWORD_POLICY.requireDigit && !/\d/.test(password)) {
    return '密码必须包含数字'
  }
  return null
}
