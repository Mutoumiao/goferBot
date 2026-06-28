import { AppException } from '../../lib/app-error.js'

export function userNotFoundError(): AppException {
  return new AppException('USER_NOT_FOUND', '用户不存在', 404)
}

export function emailAlreadyExistsError(): AppException {
  return new AppException('EMAIL_EXISTS', '邮箱已被注册', 409)
}

export function invalidCredentialsError(): AppException {
  return new AppException('AUTH_INVALID_CREDENTIALS', '邮箱或密码错误', 401)
}

export function passwordChangeFailedError(): AppException {
  return new AppException('PASSWORD_CHANGE_FAILED', '当前密码校验失败', 401)
}

export function forbiddenError(): AppException {
  return new AppException('FORBIDDEN', '无权执行该操作', 403)
}
