import type { User } from '@goferbot/data'
import { toast } from 'sonner'
import { getMe, login, logout, refresh, register, updateMe, uploadAvatar } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'
import { clearTokens, getRefreshToken, setAccessToken, setRefreshToken } from '@/utils/auth-token'
import { clearPublicKeyCache, encryptPassword } from '@/utils/password-encryption'

export interface LoginResult {
  success: boolean
  error?: string
}

export interface RegisterResult {
  success: boolean
  error?: string
}

const REMEMBER_EMAIL_KEY = 'goferbot_remember_email'

function mapAuthError(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code: string }).code
    const msg = (err as { message?: string }).message
    switch (code) {
      case 'USER_EXISTS':
        return '该邮箱已被注册'
      case 'AUTH_INVALID_CREDENTIALS':
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
    const refreshToken = res.refreshToken
    const user = res.user
    if (token && user) {
      setAccessToken(token)
      if (refreshToken) {
        setRefreshToken(refreshToken)
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
    const refreshToken = res.refreshToken
    const user = res.user
    if (token && user) {
      setAccessToken(token)
      if (refreshToken) {
        setRefreshToken(refreshToken)
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
    const refreshToken = getRefreshToken()
    if (!refreshToken) {
      return false
    }
    const res = await refresh({ refreshToken }).send()
    const token = res.accessToken
    const newRefreshToken = res.refreshToken
    if (token) {
      setAccessToken(token)
      if (newRefreshToken) {
        setRefreshToken(newRefreshToken)
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
  } catch (err) {
    // 若是认证失败（401/403），清空登录态避免游离态
    const status = (err as { status?: number }).status
    if (status === 401 || status === 403) {
      useAuthStore.getState().clearAuth()
    }
    return false
  }
}

export async function logoutUser(): Promise<void> {
  try {
    const refreshToken = getRefreshToken()
    if (refreshToken) {
      await logout({ refreshToken }).send()
    }
  } catch {
    // 即使后端登出失败也继续清理本地状态
  } finally {
    clearTokens()
    useAuthStore.getState().clearAuth()
    toast.success('已退出登录')
  }
}

export function getRememberedEmail(): string | null {
  return localStorage.getItem(REMEMBER_EMAIL_KEY)
}

export interface UpdateProfileData {
  name?: string
  avatarFile?: File
}

export interface UpdateProfileResult {
  success: boolean
  error?: string
  avatarError?: string
}

/**
 * 更新用户资料（昵称 + 头像上传的业务编排）
 * - 头像上传失败不阻塞昵称更新
 * - 昵称更新失败返回错误并保持旧值
 */
export async function updateProfile(data: UpdateProfileData): Promise<UpdateProfileResult> {
  const { name, avatarFile } = data
  const store = useAuthStore.getState()

  try {
    // 更新昵称
    if (name !== undefined && name !== store.user?.name) {
      const user = await updateMe({ name }).send()
      useAuthStore.getState().setUser(user)
      toast.success('昵称已更新')
    }

    // 上传头像（独立于昵称更新，失败不中断）
    let avatarError: string | undefined
    if (avatarFile) {
      try {
        const res = await uploadAvatar(avatarFile).send()
        const currentUser = useAuthStore.getState().user
        if (currentUser) {
          const updatedUser = { ...currentUser, avatarUrl: res.avatarUrl } as User
          useAuthStore.getState().setUser(updatedUser)
        }
        toast.success('头像已更新')
      } catch (err) {
        avatarError = mapAuthError(err)
        toast.error(avatarError || '头像上传失败，请稍后重试')
      }
    }

    return { success: true, avatarError }
  } catch (err) {
    const msg = err instanceof Error ? err.message : '更新失败，请稍后重试'
    return { success: false, error: msg }
  }
}
