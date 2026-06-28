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

export const logout = (data: { refreshToken: string }) =>
  alovaInstance.Post<{ success: boolean }>('/auth/admin/logout', data)

export const getCurrentUser = () => alovaInstance.Get<LoginResponse['user']>('/auth/me')

export const refresh = (data: { refreshToken: string }) =>
  alovaInstance.Post<LoginResponse>('/auth/admin/refresh', data)

export const changePassword = (data: { oldPassword: string; newPassword: string }) =>
  alovaInstance.Post<{ success: boolean }>('/auth/change-password', data)

export const verifyPassword = (data: { password: string }) =>
  alovaInstance.Post<{ success: boolean }>('/auth/verify-password', data)
