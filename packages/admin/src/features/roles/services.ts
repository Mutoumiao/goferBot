import { toast } from 'sonner'
import type { Permission, Role } from '@/api/role'
import {
  createRole as createRoleApi,
  deleteRole as deleteRoleApi,
  getRole as getRoleApi,
  listPermissions as listPermissionsApi,
  listRoles as listRolesApi,
  updateRole as updateRoleApi,
} from '@/api/role'
import { mapErrorMessage } from '@/utils/error-mapper'

export type { Permission, Role }

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
  } catch (err) {
    const msg = mapErrorMessage(err)
    toast.error(`获取权限列表失败：${msg}`)
    throw err
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

export async function editRoleService(
  id: string,
  data: { name?: string; description?: string; permissions?: string[] },
): Promise<{ success: boolean; error?: string }> {
  try {
    await updateRoleApi(id, data).send()
    toast.success('修改角色成功')
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

export async function fetchRole(id: string): Promise<Role> {
  try {
    return await getRoleApi(id).send()
  } catch (err) {
    const msg = mapErrorMessage(err)
    toast.error(msg)
    throw err
  }
}
