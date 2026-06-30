import { alovaInstance } from '@/utils/server'

interface LoginResponse {
  accessToken: string
  refreshToken?: string
  user: {
    id: string
    email: string
    name?: string
    role: 'ADMIN' | 'USER'
    isActive: boolean
    avatarUrl?: string | null
  }
}

export const login = (data: { email: string; password: string }) =>
  alovaInstance.Post<LoginResponse>('/auth/admin/login', data)

export interface CaptchaResponse {
  captchaId: string
  imageBase64: string
  imageUrl: string
  expiresIn: number
}

export const getCaptcha = () => alovaInstance.Get<CaptchaResponse>('/auth/captcha')

export const logout = () => alovaInstance.Post<{ success: boolean }>('/auth/admin/logout', {})

export const getCurrentUser = () => alovaInstance.Get<LoginResponse['user']>('/auth/me')

export const refresh = (data: { refreshToken: string }) =>
  alovaInstance.Post<LoginResponse>('/auth/admin/refresh', data)

// todo: 校验密码接口待补充-需要在后端实现
// 校验密码是否符合要求（长度、包含字母、数字、特殊字符等）
export const verifyPassword = (data: { password: string }) =>
  alovaInstance.Post<{ success: boolean }>('/auth/admin/verify-password', data)
