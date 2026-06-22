import { toast } from 'sonner'
import {
  createRole as createRoleApi,
  deleteRole as deleteRoleApi,
  getRole as getRoleApi,
  listPermissions as listPermissionsApi,
  listRoles as listRolesApi,
  updateRole as updateRoleApi,
  type Permission,
  type Role,
} from '@/api/role'
import { mapErrorMessage } from '@/utils/error-mapper'

export async function fetchRoles(): Promise<Role[]> {
  try {
    return await listRolesApi().send()
  } catch (err) {
    const msg = mapErrorMessage(err)
    toast.error(msg)
    return []
  }
}

export async function fetchPermissions(): Promise<Permission[]> {
  try {
    return await listPermissionsApi().send()
  } catch {
    return getMockPermissions()
  }
}

export async function createRoleService(data: {
  name: string
  description?: string
  permissions: string[]
}): Promise<{ success: boolean; error?: string }> {
  try {
    await createRoleApi(data).send()
    toast.success('创建角色成功')
    return { success: true }
  } catch (err) {
    const msg = mapErrorMessage(err)
    toast.error(msg)
    return { success: false, error: msg }
  }
}

export async function updateRoleService(
  id: string,
  data: { name?: string; description?: string; permissions?: string[] },
): Promise<{ success: boolean; error?: string }> {
  try {
    await updateRoleApi(id, data).send()
    toast.success('修改成功')
    return { success: true }
  } catch (err) {
    const msg = mapErrorMessage(err)
    toast.error(msg)
    return { success: false, error: msg }
  }
}

export async function deleteRoleService(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await deleteRoleApi(id).send()
    toast.success('角色已删除')
    return { success: true }
  } catch (err) {
    const msg = mapErrorMessage(err)
    toast.error(msg)
    return { success: false, error: msg }
  }
}

export async function fetchRole(id: string): Promise<Role | null> {
  try {
    return await getRoleApi(id).send()
  } catch {
    return null
  }
}

function getMockPermissions(): Permission[] {
  return [
    { key: 'user:read', name: '查看用户', group: '用户管理', description: '查看用户列表' },
    { key: 'user:create', name: '创建用户', group: '用户管理', description: '创建新用户' },
    { key: 'user:update', name: '修改用户', group: '用户管理', description: '修改用户信息' },
    { key: 'user:delete', name: '删除用户', group: '用户管理', description: '删除用户' },
    { key: 'role:read', name: '查看角色', group: '权限管理' },
    { key: 'role:create', name: '创建角色', group: '权限管理' },
    { key: 'role:update', name: '修改角色', group: '权限管理' },
    { key: 'role:delete', name: '删除角色', group: '权限管理' },
    { key: 'session:read', name: '查看会话', group: '会话观测' },
    { key: 'session:mask', name: '查看原始数据', group: '会话观测' },
    { key: 'model:read', name: '查看模型', group: '模型设置' },
    { key: 'model:create', name: '创建模型', group: '模型设置' },
    { key: 'model:update', name: '修改模型', group: '模型设置' },
    { key: 'model:delete', name: '删除模型', group: '模型设置' },
    { key: 'audit:read', name: '查看审计', group: '审计日志' },
  ]
}
