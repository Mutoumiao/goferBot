import { alovaInstance } from '@/utils/server'

export interface Role {
  id: string
  name: string
  description?: string
  isBuiltIn?: boolean
  permissions: string[]
  createdAt: string
  updatedAt: string
}

export interface Permission {
  key: string
  name: string
  description?: string
  group: string
}

export const listRoles = () => alovaInstance.Get<Role[]>('/admin/roles')
export const createRole = (data: { name: string; description?: string; permissions: string[] }) =>
  alovaInstance.Post<Role>('/admin/roles', data)
export const updateRole = (
  id: string,
  data: { name?: string; description?: string; permissions?: string[] },
) => alovaInstance.Patch<Role>(`/admin/roles/${id}`, data)
export const deleteRole = (id: string) => alovaInstance.Delete<{ success: boolean }>(`/admin/roles/${id}`)
export const getRole = (id: string) => alovaInstance.Get<Role>(`/admin/roles/${id}`)
export const listPermissions = () => alovaInstance.Get<Permission[]>('/admin/permissions')
