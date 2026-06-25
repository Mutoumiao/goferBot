import { toast } from 'sonner'
import { changePassword, getCurrentUser, login as loginApi, refresh } from '@/api/auth'
import type { AdminUser } from '@/stores/auth'
import { useAuthStore } from '@/stores/auth'
import { clearTokens, getRefreshToken, setAccessToken, setRefreshToken } from '@/utils/auth-token'
import { mapErrorMessage } from '@/utils/error-mapper'

export interface LoginResult {
  success: boolean
  error?: string
}

export async function loginService(email: string, password: string): Promise<LoginResult> {
  if (!email.trim() || !password) {
    return { success: false, error: '请输入邮箱和密码' }
  }

  try {
    const res = await loginApi({ email, password }).send()
    const token = res.accessToken
    const refreshToken = res.refreshToken
    const user = res.user as AdminUser

    if (token && user) {
      setAccessToken(token)
      if (refreshToken) setRefreshToken(refreshToken)
      useAuthStore.getState().setAuth(token, user)
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
    const res = await refresh().send()
    const token = res.accessToken
    const newRefreshToken = res.refreshToken
    if (token) {
      setAccessToken(token)
      if (newRefreshToken) setRefreshToken(newRefreshToken)
      return true
    }
    return false
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

export function logoutService(): void {
  clearTokens()
  useAuthStore.getState().clearAuth()
  toast.success('已退出登录')
}

export async function changePasswordService(
  oldPassword: string,
  newPassword: string,
): Promise<LoginResult> {
  try {
    await changePassword({ oldPassword, newPassword }).send()
    toast.success('密码已修改，请重新登录')
    logoutService()
    return { success: true }
  } catch (err) {
    const msg = mapErrorMessage(err)
    toast.error(msg)
    return { success: false, error: msg }
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
  return !!getRefreshToken()
}
