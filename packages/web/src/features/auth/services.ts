import { login, register, getMe, refresh } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'
import { encryptPassword, clearPublicKeyCache } from '@/utils/password-encryption'
import { toast } from 'sonner'

export interface LoginResult {
  success: boolean
  error?: string
}

export interface RegisterResult {
  success: boolean
  error?: string
}

const ACCESS_TOKEN_KEY = 'goferbot_access_token'
const REFRESH_TOKEN_KEY = 'goferbot_refresh_token'
const REMEMBER_EMAIL_KEY = 'goferbot_remember_email'

function mapAuthError(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code: string }).code
    const msg = (err as { message?: string }).message
    switch (code) {
      case 'USER_EXISTS':
        return '该邮箱已被注册'
      case 'AUTH_FAIL':
        return '邮箱或密码错误'
      case 'ACCOUNT_DISABLED':
        return '账号已被禁用'
      case 'INVALID_REFRESH_TOKEN':
        return '登录已过期，请重新登录'
      case 'USER_NOT_FOUND':
        return '用户不存在'
      case 'DECRYPT_FAILED':
        return '加密密钥已过期，请刷新页面后重试'
      case 'VALIDATION_ERROR':
        return msg || '输入信息不符合要求'
      default:
        return msg || '操作失败，请稍后重试'
    }
  }
  if (err instanceof Error) {
    return err.message
  }
  return '操作失败，请稍后重试'
}

export async function loginUser(
  email: string,
  password: string,
  rememberMe: boolean,
): Promise<LoginResult> {
  if (!email.trim() || !password) {
    return { success: false, error: '请输入邮箱和密码' }
  }

  try {
    const encryptedPassword = await encryptPassword(password)
    const res = await login({ email, encryptedPassword }).send()
    const token = res.accessToken
    const refreshToken = (res as unknown as { refreshToken?: string }).refreshToken
    const user = res.user
    if (token && user) {
      localStorage.setItem(ACCESS_TOKEN_KEY, token)
      if (refreshToken) {
        localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
      }
      if (rememberMe) {
        localStorage.setItem(REMEMBER_EMAIL_KEY, email)
      } else {
        localStorage.removeItem(REMEMBER_EMAIL_KEY)
      }
      useAuthStore.getState().setAuth(token, user)
      return { success: true }
    }
    return { success: false, error: '登录响应异常' }
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === 'DECRYPT_FAILED') {
      clearPublicKeyCache()
    }
    return { success: false, error: mapAuthError(err) }
  }
}

export async function registerUser(
  name: string,
  email: string,
  password: string,
): Promise<RegisterResult> {
  if (!name.trim() || !email.trim() || !password) {
    return { success: false, error: '请填写所有字段' }
  }

  try {
    const encryptedPassword = await encryptPassword(password)
    const res = await register({ email, encryptedPassword, name }).send()
    const token = res.accessToken
    const refreshToken = (res as unknown as { refreshToken?: string }).refreshToken
    const user = res.user
    if (token && user) {
      localStorage.setItem(ACCESS_TOKEN_KEY, token)
      if (refreshToken) {
        localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
      }
      useAuthStore.getState().setAuth(token, user)
      return { success: true }
    }
    return { success: false, error: '注册响应异常' }
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === 'DECRYPT_FAILED') {
      clearPublicKeyCache()
    }
    return { success: false, error: mapAuthError(err) }
  }
}

export async function refreshAuth(): Promise<boolean> {
  try {
    const res = await refresh().send()
    const token = res.accessToken
    const refreshToken = (res as unknown as { refreshToken?: string }).refreshToken
    if (token) {
      localStorage.setItem(ACCESS_TOKEN_KEY, token)
      if (refreshToken) {
        localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
      }
      return true
    }
    return false
  } catch {
    return false
  }
}

export async function fetchCurrentUser(): Promise<boolean> {
  try {
    const user = await getMe().send()
    useAuthStore.getState().setUser(user)
    return true
  } catch {
    return false
  }
}

export function logoutUser(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  useAuthStore.getState().clearAuth()
  toast.success('已退出登录')
}

export function getRememberedEmail(): string | null {
  return localStorage.getItem(REMEMBER_EMAIL_KEY)
}
