import { login, register } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'
import { toast } from 'sonner'

export interface LoginResult {
  success: boolean
  error?: string
}

export interface RegisterResult {
  success: boolean
  error?: string
}

export async function loginUser(
  email: string,
  password: string,
  rememberMe: boolean,
): Promise<LoginResult> {
  if (!email || !password) {
    return { success: false, error: '请输入邮箱和密码' }
  }

  try {
    const res = await login({ email, password }).send()
    const token = res.accessToken
    const user = res.user
    if (token && user) {
      localStorage.setItem('goferbot_access_token', token)
      if (rememberMe) {
        localStorage.setItem('goferbot_remember_email', email)
      } else {
        localStorage.removeItem('goferbot_remember_email')
      }
      useAuthStore.getState().setAuth(token, user)
      return { success: true }
    }
    return { success: false, error: '登录响应异常' }
  } catch (err) {
    const message = err instanceof Error ? err.message : '登录失败，请检查邮箱和密码'
    return { success: false, error: message }
  }
}

export async function registerUser(
  name: string,
  email: string,
  password: string,
): Promise<RegisterResult> {
  if (!email || !password || !name) {
    return { success: false, error: '请填写所有字段' }
  }

  try {
    const res = await register({ email, password, name }).send()
    const token = res.accessToken
    const user = res.user
    if (token && user) {
      localStorage.setItem('goferbot_access_token', token)
      useAuthStore.getState().setAuth(token, user)
      return { success: true }
    }
    return { success: false, error: '注册响应异常' }
  } catch (err) {
    const message = err instanceof Error ? err.message : '注册失败，请重试'
    return { success: false, error: message }
  }
}

export function logoutUser(): void {
  useAuthStore.getState().clearAuth()
  toast.success('已退出登录')
}
