import { AppException } from '../lib/app-error.js'

/**
 * 认证错误工厂函数
 * 统一构造认证领域的业务异常，确保错误码和 HTTP 状态码一致
 */

export function noAuthTokenError(): AppException {
  return new AppException('NO_AUTH_TOKEN', '未登录或令牌已过期', 401)
}

export function invalidCredentialsError(): AppException {
  return new AppException('AUTH_INVALID_CREDENTIALS', '邮箱或密码错误', 401)
}

export function accountDisabledError(): AppException {
  return new AppException('ACCOUNT_DISABLED', '账号已被禁用', 403)
}

export function noAppRoleError(app: string): AppException {
  return new AppException(
    `NO_${app.toUpperCase()}_ROLE`,
    `无权访问${app === 'admin' ? '管理后台' : '系统'}`,
    403,
  )
}

export function noAdminRoleError(): AppException {
  return noAppRoleError('admin')
}

export function invalidTokenTypeError(): AppException {
  return new AppException('INVALID_TOKEN_TYPE', '无效的令牌类型', 401)
}

export function tokenNotFoundError(): AppException {
  return new AppException('TOKEN_NOT_FOUND', '刷新令牌无效', 401)
}

export function tokenReplayError(): AppException {
  return new AppException('TOKEN_REPLAY', '检测到令牌重放攻击，会话已撤销', 401)
}

export function tokenRevokedError(): AppException {
  return new AppException('TOKEN_REVOKED', '刷新令牌已撤销', 401)
}

export function sessionRevokedError(): AppException {
  return new AppException('SESSION_REVOKED', '会话已撤销', 401)
}

export function userNotFoundError(): AppException {
  return new AppException('USER_NOT_FOUND', '用户不存在', 401)
}

export function invalidRefreshTokenError(details?: string): AppException {
  return new AppException(
    'INVALID_REFRESH_TOKEN',
    '刷新令牌无效或已过期',
    401,
    details ? { reason: details } : undefined,
  )
}

export function appMismatchError(): AppException {
  return new AppException('APP_MISMATCH', '令牌应用不匹配', 403)
}

export function invitationCodeInvalidError(): AppException {
  return new AppException('INVITATION_CODE_INVALID', '无效的邀请码', 400)
}

export function invitationCodeUsedError(): AppException {
  return new AppException('INVITATION_CODE_USED', '邀请码已被使用', 400)
}

export function invitationCodeExpiredError(): AppException {
  return new AppException('INVITATION_CODE_EXPIRED', '邀请码已过期', 400)
}

export function invitationCodeMaxUsesError(): AppException {
  return new AppException('INVITATION_CODE_MAX_USES', '邀请码已达使用上限', 400)
}
export function superAdminProtectedError(): AppException {
  return new AppException('SUPER_ADMIN_PROTECTED', '必须保留至少一个启用的超级管理员', 400)
}
