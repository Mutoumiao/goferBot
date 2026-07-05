import { toast } from 'sonner'
import { getCurrentUser, login as loginApi, logout, refresh } from '@/api/auth'
import { ROUTES_REGISTER } from '@/router-register'
import type { AdminUser } from '@/stores/auth'
import { useAuthStore } from '@/stores/auth'
import { mapErrorMessage } from '@/utils/error-mapper'
import { clearPublicKeyCache, encryptPassword } from '@/utils/password-encryption'

export interface LoginResult {
  success: boolean
  error?: string
}

function mapAuthError(err: unknown): string {
  const code = (err as { code?: string }).code
  const status = (err as { status?: number }).status
  if (code === 'DECRYPT_FAILED') {
    return '加密密钥已过期，请刷新页面后重试'
  }
  if (code === 'AUTH_FAIL' || (status === 401 && code !== 'DECRYPT_FAILED')) {
    return '账号或密码错误'
  }
  return mapErrorMessage(err)
}

export async function loginService(
  email: string,
  password: string,
  captcha?: { captchaId: string; captchaCode: string },
): Promise<LoginResult> {
  if (!email.trim() || !password) {
    return { success: false, error: '请输入邮箱和密码' }
  }

  try {
    return await attemptLogin(email, password, captcha)
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === 'DECRYPT_FAILED') {
      clearPublicKeyCache()
      try {
        return await attemptLogin(email, password, captcha)
      } catch (retryErr) {
        const msg = mapAuthError(retryErr)
        toast.error(msg)
        return { success: false, error: msg }
      }
    }
    const msg = mapAuthError(err)
    toast.error(msg)
    return { success: false, error: msg }
  }
}

async function attemptLogin(
  email: string,
  password: string,
  captcha?: { captchaId: string; captchaCode: string },
): Promise<LoginResult> {
  const encryptedPassword = await encryptPassword(password)
  const res = await loginApi({ email, encryptedPassword, ...(captcha ?? {}) }).send()
  const user = res.user

  if (user) {
    useAuthStore.getState().setUser(user)
    return { success: true }
  }
  return { success: false, error: '登录响应异常' }
}

export async function refreshAuth(): Promise<boolean> {
  try {
    await refresh().send()
    return true
  } catch {
    return false
  }
}

export async function fetchCurrentUser(): Promise<boolean> {
  try {
    const user = await getCurrentUser().send()
    useAuthStore.getState().setUser(user as AdminUser)
    return true
  } catch (err) {
    const status = (err as { status?: number }).status
    if (status === 401 || status === 403) {
      useAuthStore.getState().clearAuth()
    }
    return false
  }
}

export async function logoutService(): Promise<void> {
  try {
    await logout().send()
    toast.success('已退出登录')
  } catch {
  } finally {
    useAuthStore.getState().clearAuth()
    window.location.replace(ROUTES_REGISTER.login.path)
  }
}

export function getRememberedEmail(): string | null {
  return localStorage.getItem('goferbot_admin_remember_email')
}

export function setRememberedEmail(email: string | null): void {
  if (email) {
    localStorage.setItem('goferbot_admin_remember_email', email)
  } else {
    localStorage.removeItem('goferbot_admin_remember_email')
  }
}

export function hasRefreshToken(): boolean {
  return false
}
