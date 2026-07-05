import type { AdminUser } from '@/stores/auth'
import { alovaInstance } from '@/utils/server'

interface PublicKeyResponse {
  publicKey: string
  algorithm: string
  hash: string
}

interface LoginResponse {
  user: AdminUser
}

export const getPublicKey = () => alovaInstance.Get<PublicKeyResponse>('/auth/public-key')

export const login = (data: { email: string; encryptedPassword: string }) =>
  alovaInstance.Post<LoginResponse>('/admin/auth/login', data)

export interface CaptchaResponse {
  captchaId: string
  imageBase64: string
  imageUrl: string
  expiresIn: number
}

export const getCaptcha = () => alovaInstance.Get<CaptchaResponse>('/auth/captcha')

export const logout = () => alovaInstance.Post<{ success: boolean }>('/admin/auth/logout', {})

export const getCurrentUser = () => alovaInstance.Get<AdminUser>('/auth/me')

export const refresh = () => alovaInstance.Post<LoginResponse>('/admin/auth/refresh')

export const changePassword = (data: { currentPassword: string; newPassword: string }) =>
  alovaInstance.Post<{ success: boolean }>('/user/change-password', data)

export const verifyPassword = (data: { password: string }) =>
  alovaInstance.Post<{ success: boolean }>('/auth/verify-password', data)
