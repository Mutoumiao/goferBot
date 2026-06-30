import { toast } from 'sonner'
import { getCurrentUser, login as loginApi, logout, refresh } from '@/api/auth'
import type { AdminUser } from '@/stores/auth'
import { useAuthStore } from '@/stores/auth'
import { mapErrorMessage } from '@/utils/error-mapper'

export interface LoginResult {
  success: boolean
  error?: string
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
    const res = await loginApi({ email, password, ...(captcha ?? {}) }).send()
    const user = res.user as AdminUser

    if (user) {
      useAuthStore.getState().setUser(user)
      return { success: true }
    }
    return { success: false, error: '登录响应异常' }
  } catch (err) {
    const msg = mapErrorMessage(err)
    toast.error(msg)
    return { success: false, error: msg }
  }
}

export async function refreshAuth(): Promise<boolean> {
  try {
    // Refresh token is in HttpOnly cookie, backend reads it automatically
    await refresh({ refreshToken: '' }).send()
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
  } catch {
  } finally {
    useAuthStore.getState().clearAuth()
    toast.success('已退出登录')
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

// Note: Refresh token is now managed via HttpOnly cookies
// This function kept for backward compatibility, always returns false
export function hasRefreshToken(): boolean {
  return false
}
