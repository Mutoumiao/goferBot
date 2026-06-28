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
export const login = (data: LoginRequest) => alovaInstance.Post<AuthResponse>('/auth/web/login', data)

/**
 * 登出 — 携带 refreshToken 撤销服务端会话
 */
export const logout = (data: { refreshToken: string }) =>
  alovaInstance.Post<{ success: boolean }>('/auth/web/logout', data)

/**
 * 注册 — 返回 accessToken + user
 */
export const register = (data: RegisterRequest) =>
  alovaInstance.Post<AuthResponse>('/auth/register', data)

/**
 * 获取当前用户信息（需 Bearer Token）
 */
export const getMe = () => alovaInstance.Get<User>('/auth/me')

/**
 * Token 刷新 — 由 alova 拦截器自动调用，一般不直接使用
 */
export const refresh = (data: { refreshToken: string }) =>
  alovaInstance.Post<AuthResponse>('/auth/web/refresh', data)

/**
 * 获取 RSA 公钥（用于密码加密）
 */
export const getPublicKey = () => alovaInstance.Get<PublicKeyResponse>('/auth/public-key')

/**
 * 更新当前用户信息（昵称等）
 */
export const updateMe = (data: { name?: string }) => alovaInstance.Patch<User>('/auth/me', data)

/**
 * 上传用户头像（multipart/form-data）
 */
export const uploadAvatar = (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  return alovaInstance.Post<{ avatarUrl: string }>('/auth/avatar', formData)
}
