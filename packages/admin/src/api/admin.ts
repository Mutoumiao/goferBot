import type {
  AdminUser,
  AdminUserListQuery,
  AdminUserListResponse,
  AssignRoleRequest,
  CreateAdminUserRequest,
  ResetPasswordRequest,
  UpdateAdminUserRequest,
  UpdateUserStatusRequest,
} from '@goferbot/data'
import { alovaInstance } from '@/utils/server'

export type AdminUserResponse = AdminUser
export type ListUsersQuery = AdminUserListQuery
export type PagedResponse<T> = Omit<AdminUserListResponse, 'items'> & { items: T[] }

export const listUsers = (query: ListUsersQuery) =>
  alovaInstance.Get<PagedResponse<AdminUserResponse>>('/admin/users', { params: query })

export const createUser = (data: CreateAdminUserRequest) =>
  alovaInstance.Post<AdminUserResponse>('/admin/users', data)

export const updateUser = (id: string, data: UpdateAdminUserRequest) =>
  alovaInstance.Patch<AdminUserResponse>(`/admin/users/${id}`, data)

export const updateUserStatus = (id: string, data: UpdateUserStatusRequest) =>
  alovaInstance.Patch<{ success: boolean }>(`/admin/users/${id}/status`, data)

export const deleteUser = (id: string) =>
  alovaInstance.Delete<{ success: boolean }>(`/admin/users/${id}`)

export const resetPassword = (id: string, data: ResetPasswordRequest) =>
  alovaInstance.Post<{ success: boolean }>(`/admin/users/${id}/reset-password`, data)

export const assignRole = (id: string, data: AssignRoleRequest) =>
  alovaInstance.Post<{ success: boolean }>(`/admin/users/${id}/role`, data)

export const getUser = (id: string) => alovaInstance.Get<AdminUserResponse>(`/admin/users/${id}`)
