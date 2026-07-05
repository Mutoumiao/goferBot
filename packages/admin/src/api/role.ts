import { alovaInstance } from '@/utils/server'

export interface Role {
  code: string
  name: string
  description: string | null
  app: string
  isSystem: boolean
  sortOrder: number
  status: string
  permissions: string[]
  userCount: number
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
export const createRole = (data: {
  code: string
  name: string
  description?: string
  app?: string
}) => alovaInstance.Post<Role>('/admin/roles', data)
export const updateRole = (
  code: string,
  data: { name?: string; description?: string; sortOrder?: number; permissions?: string[] },
) => alovaInstance.Patch<Role>(`/admin/roles/${code}`, data)
export const deleteRole = (code: string) =>
  alovaInstance.Delete<{ success: boolean }>(`/admin/roles/${code}`)
export const getRole = (code: string) => alovaInstance.Get<Role>(`/admin/roles/${code}`)
export const listPermissions = () => alovaInstance.Get<Permission[]>('/admin/roles/permissions')
