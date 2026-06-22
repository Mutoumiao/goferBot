import { alovaInstance } from '@/utils/server'

export interface AdminUserResponse {
  id: string
  email: string
  name?: string
  role: 'ADMIN' | 'USER'
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface PagedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface ListUsersQuery {
  page?: number
  pageSize?: number
  search?: string
  isActive?: boolean
  role?: 'ADMIN' | 'USER'
}

export const listUsers = (query: ListUsersQuery) =>
  alovaInstance.Get<PagedResponse<AdminUserResponse>>('/admin/users', { params: query })

export const createUser = (data: {
  email: string
  name?: string
  password: string
  role: 'ADMIN' | 'USER'
}) => alovaInstance.Post<AdminUserResponse>('/admin/users', data)

export const updateUser = (
  id: string,
  data: {
    name?: string
    role?: 'ADMIN' | 'USER'
    isActive?: boolean
    updatedAt?: string
  },
) => alovaInstance.Patch<AdminUserResponse>(`/admin/users/${id}`, data)

export const updateUserStatus = (id: string, data: { isActive: boolean }) =>
  alovaInstance.Patch<{ success: boolean }>(`/admin/users/${id}/status`, data)

export const deleteUser = (id: string) =>
  alovaInstance.Delete<{ success: boolean }>(`/admin/users/${id}`)

export const resetPassword = (id: string, data: { newPassword: string }) =>
  alovaInstance.Post<{ success: boolean }>(`/admin/users/${id}/reset-password`, data)

export const assignRole = (id: string, data: { role: 'ADMIN' | 'USER' }) =>
  alovaInstance.Post<{ success: boolean }>(`/admin/users/${id}/role`, data)

export const getUser = (id: string) =>
  alovaInstance.Get<AdminUserResponse>(`/admin/users/${id}`)
