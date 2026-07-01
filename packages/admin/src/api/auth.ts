import { alovaInstance } from '@/utils/server'

interface PublicKeyResponse {
  publicKey: string
  algorithm: string
  hash: string
}

interface LoginResponse {
  accessToken: string
  refreshToken?: string
  mustChangePassword?: boolean
  user: {
    id: string
    email: string
    name?: string
    role: 'ADMIN' | 'USER' | 'SUPER_ADMIN'
    isActive: boolean
    mustChangePassword?: boolean
    avatarUrl?: string | null
    permissions?: string[]
  }
}

export const getPublicKey = () => alovaInstance.Get<PublicKeyResponse>('/auth/public-key')

export const login = (data: { email: string; encryptedPassword: string }) =>
  alovaInstance.Post<LoginResponse>('/auth/admin/login', data)

export interface CaptchaResponse {
  captchaId: string
  imageBase64: string
  imageUrl: string
  expiresIn: number
}

export const getCaptcha = () => alovaInstance.Get<CaptchaResponse>('/auth/captcha')

export const logout = () => alovaInstance.Post<{ success: boolean }>('/auth/admin/logout', {})

export const getCurrentUser = () =>
  alovaInstance.Get<LoginResponse['user'] & { permissions?: string[] }>('/auth/me')

export const refresh = (data: { refreshToken: string }) =>
  alovaInstance.Post<LoginResponse>('/auth/admin/refresh', data)

export const changePassword = (data: { currentPassword: string; newPassword: string }) =>
  alovaInstance.Post<{ success: boolean }>('/auth/change-password', data)

export const changePasswordForce = (data: { newPassword: string }) =>
  alovaInstance.Post<{ success: boolean }>('/auth/change-password/force', data)

// todo: 校验密码接口待补充-需要在后端实现
// 校验密码是否符合要求（长度、包含字母、数字、特殊字符等）
export const verifyPassword = (data: { password: string }) =>
  alovaInstance.Post<{ success: boolean }>('/auth/admin/verify-password', data)
