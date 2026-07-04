import type { AuthResponse, LoginRequest, RegisterRequest, User } from '@goferbot/data'
import { alovaInstance } from '@/utils/server'

interface PublicKeyResponse {
  publicKey: string
  algorithm: string
  hash: string
}

/**
 * 登录 — 返回 accessToken + user
 */
export const login = (data: LoginRequest) =>
  alovaInstance.Post<AuthResponse>('/auth/web/login', data)

/**
 * 登出 — 服务端从 HttpOnly Cookie 读取 refreshToken 撤销会话
 */
export const logout = () => alovaInstance.Post<{ success: boolean }>('/auth/web/logout', {})

/**
 * 注册 — 返回 accessToken + user
 */
export const register = (data: RegisterRequest) =>
  alovaInstance.Post<AuthResponse>('/auth/web/register', data)

/**
 * 获取当前用户信息（需 Bearer Token）
 */
export const getMe = () => alovaInstance.Get<User>('/auth/me')

/**
 * Token 刷新 — 由 alova 拦截器自动调用，一般不直接使用
 */
export const refresh = () => alovaInstance.Post<AuthResponse>('/auth/web/refresh', {})

/**
 * 获取 RSA 公钥（用于密码加密）
 */
export const getPublicKey = () => alovaInstance.Get<PublicKeyResponse>('/auth/public-key')

export interface CaptchaResponse {
  captchaId: string
  imageBase64: string
  imageUrl: string
  expiresIn: number
}

/**
 * 获取图形验证码（captchaId + base64 图片）
 */
export const getCaptcha = () => alovaInstance.Get<CaptchaResponse>('/auth/captcha')

/**
 * 更新当前用户信息（昵称等）
 */
export const updateMe = (data: { name?: string }) => alovaInstance.Patch<User>('/user/me', data)

/**
 * 上传用户头像（multipart/form-data）
 */
export const uploadAvatar = (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  return alovaInstance.Post<{ avatar: string | null }>('/user/avatar', formData)
}
