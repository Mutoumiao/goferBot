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
  alovaInstance.Post<LoginResponse>('/auth/login', data)

export const getCurrentUser = () =>
  alovaInstance.Get<LoginResponse['user']>('/auth/me')

export const refresh = () =>
  alovaInstance.Post<LoginResponse>('/auth/refresh')

export const changePassword = (data: {
  oldPassword: string
  newPassword: string
}) => alovaInstance.Post<{ success: boolean }>('/auth/change-password', data)

export const verifyPassword = (data: { password: string }) =>
  alovaInstance.Post<{ success: boolean }>('/auth/verify-password', data)
