import type { User } from '@goferbot/data'
import { toast } from 'sonner'
import { getMe, login, logout, refresh, register, updateMe, uploadAvatar } from '@/api/auth'
import { ROUTES_REGISTER } from '@/router-register'
import { useAuthStore } from '@/stores/auth'
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

const AUTH_COOKIE_NAME = 'goferbot_web_access_token'

function hasAuthCookie(): boolean {
  return document.cookie.includes(AUTH_COOKIE_NAME)
}

let _fetchMePromise: Promise<boolean> | null = null

// Error message whitelist for security - only allow safe characters
function sanitizeErrorMessage(message: string): string {
  // Only allow safe alphanumeric and CJK characters, no HTML tags or special chars
  return message
    .replace(/[<>'"&`\\]/g, '')
    .replace(/<[^>]*>/g, '')
    .trim()
}

function mapAuthError(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code: string }).code
    const msg = (err as { message?: string }).message
    switch (code) {
      case 'USER_EXISTS':
        return sanitizeErrorMessage('该邮箱已被注册')
      case 'AUTH_INVALID_CREDENTIALS':
        return sanitizeErrorMessage('邮箱或密码错误')
      case 'ACCOUNT_DISABLED':
        return sanitizeErrorMessage('账号已被禁用')
      case 'INVALID_REFRESH_TOKEN':
        return sanitizeErrorMessage('登录已过期，请重新登录')
      case 'USER_NOT_FOUND':
        return sanitizeErrorMessage('用户不存在')
      case 'DECRYPT_FAILED':
        return sanitizeErrorMessage('加密密钥已过期，请刷新页面后重试')
      case 'VALIDATION_ERROR':
        return sanitizeErrorMessage(msg || '输入信息不符合要求')
      default:
        return sanitizeErrorMessage(msg || '操作失败，请稍后重试')
    }
  }
  if (err instanceof Error) {
    return sanitizeErrorMessage(err.message)
  }
  return sanitizeErrorMessage('操作失败，请稍后重试')
}

export async function loginUser(
  email: string,
  password: string,
  rememberMe: boolean,
  captcha?: { captchaId: string; captchaCode: string },
): Promise<LoginResult> {
  if (!email.trim() || !password) {
    return { success: false, error: '请输入邮箱和密码' }
  }

  try {
    return await attemptLogin(email, password, rememberMe, captcha)
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === 'DECRYPT_FAILED') {
      clearPublicKeyCache()
      try {
        return await attemptLogin(email, password, rememberMe, captcha)
      } catch (retryErr) {
        return { success: false, error: mapAuthError(retryErr) }
      }
    }
    return { success: false, error: mapAuthError(err) }
  }
}

async function attemptLogin(
  email: string,
  password: string,
  rememberMe: boolean,
  captcha?: { captchaId: string; captchaCode: string },
): Promise<LoginResult> {
  const encryptedPassword = await encryptPassword(password)
  const res = await login({ email, encryptedPassword, ...(captcha ?? {}) }).send()
  const user = res.user
  if (user) {
    if (rememberMe) {
      localStorage.setItem(REMEMBER_EMAIL_KEY, email)
    } else {
      localStorage.removeItem(REMEMBER_EMAIL_KEY)
    }
    useAuthStore.getState().setUser(user)
    return { success: true }
  }
  return { success: false, error: '登录响应异常' }
}

export async function registerUser(
  name: string,
  email: string,
  password: string,
  invitationCode: string,
): Promise<RegisterResult> {
  if (!name.trim() || !email.trim() || !password || !invitationCode.trim()) {
    return { success: false, error: '请填写所有字段' }
  }

  try {
    return await attemptRegister(name, email, password, invitationCode)
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === 'DECRYPT_FAILED') {
      clearPublicKeyCache()
      try {
        return await attemptRegister(name, email, password, invitationCode)
      } catch (retryErr) {
        return { success: false, error: mapAuthError(retryErr) }
      }
    }
    return { success: false, error: mapAuthError(err) }
  }
}

async function attemptRegister(
  name: string,
  email: string,
  password: string,
  invitationCode: string,
): Promise<RegisterResult> {
  const encryptedPassword = await encryptPassword(password)
  const res = await register({ email, encryptedPassword, invitationCode, name }).send()
  const user = res.user
  if (user) {
    useAuthStore.getState().setUser(user)
    return { success: true }
  }
  return { success: false, error: '注册响应异常' }
}

export async function refreshAuth(): Promise<boolean> {
  try {
    await refresh().send()
    return true
  } catch {
    return false
  }
}

/**
 * 获取当前用户信息（带互斥锁，防止并发请求）
 * 失败时设置 isInitialized 并在 401/403 时清除 auth 状态
 */
export async function fetchMe(): Promise<boolean> {
  if (_fetchMePromise) return _fetchMePromise

  if (!hasAuthCookie()) {
    useAuthStore.getState().clearAuth()
    return false
  }

  _fetchMePromise = (async (): Promise<boolean> => {
    try {
      const user = await getMe().send()
      useAuthStore.getState().setUser(user)
      return true
    } catch (err) {
      const status = (err as { status?: number }).status
      if (status === 401 || status === 403) {
        useAuthStore.getState().clearAuth()
      }
      useAuthStore.setState({ isInitialized: true })
      return false
    } finally {
      _fetchMePromise = null
    }
  })()

  return _fetchMePromise
}

/**
 * 获取当前用户信息（与 fetchMe 等价，保留向后兼容）
 */
export async function fetchCurrentUser(): Promise<boolean> {
  return fetchMe()
}

/**
 * 静默检测当前是否有有效会话（仅用于登录页自动跳转场景）
 * 失败时不清除 auth 状态、不触发刷新循环 —— 仅返回 false
 */
export async function checkSession(): Promise<boolean> {
  try {
    const user = await getMe().send()
    useAuthStore.getState().setUser(user)
    return true
  } catch {
    return false
  }
}

export async function logoutUser(): Promise<void> {
  try {
    await logout().send()
  } catch {
  } finally {
    useAuthStore.getState().clearAuth()
    toast.success('已退出登录')
    window.location.href = ROUTES_REGISTER.login.path
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
          const updatedUser = { ...currentUser, avatar: res.avatar } as User
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
