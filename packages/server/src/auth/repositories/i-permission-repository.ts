import type { Permission, RolePermission } from '@prisma/client'
import type { AuthApp } from '../types/auth-app.type.js'

export interface IPermissionRepository {
  getPermissionsByRoleCode(roleCode: string, app: AuthApp): Promise<Permission[]>
  getPermissionsByUserId(userId: string, app: AuthApp): Promise<string[]>
  getAllPermissions(app?: AuthApp): Promise<Permission[]>
  getPermissionByCode(code: string): Promise<Permission | null>
  createPermission(data: {
    code: string
    name: string
    description?: string
    type?: string
    resource?: string
    parentCode?: string
    sortOrder?: number
    status?: string
  }): Promise<Permission>
  createRolePermission(data: {
    roleCode: string
    permissionId: string
    app: AuthApp
  }): Promise<RolePermission>
  batchCreateRolePermissions(roleCode: string, permissionIds: string[], app: AuthApp): Promise<void>
}
