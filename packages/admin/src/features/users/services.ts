import { toast } from 'sonner'
import {
  assignRole as assignRoleApi,
  createUser as createUserApi,
  deleteUser as deleteUserApi,
  getUser as getUserApi,
  listUsers as listUsersApi,
  resetPassword as resetPasswordApi,
  updateUserStatus as updateUserStatusApi,
  updateUser as updateUserApi,
} from '@/api/admin'
import type {
  AdminUserResponse,
  ListUsersQuery,
  PagedResponse,
} from '@/api/admin'
import { isConflict, isForbidden, mapErrorMessage } from '@/utils/error-mapper'

export type { AdminUserResponse, ListUsersQuery, PagedResponse }

export interface UsersState {
  list: AdminUserResponse[]
  total: number
  loading: boolean
  query: ListUsersQuery
}

export interface ListUsersOptions extends ListUsersQuery {}

export async function fetchUsers(query: ListUsersOptions): Promise<PagedResponse<AdminUserResponse>> {
  try {
    return await listUsersApi(query).send()
  } catch (err) {
    const msg = mapErrorMessage(err)
    toast.error(msg)
    throw err
  }
}

export async function toggleUserStatus(id: string, current: boolean): Promise<void> {
  try {
    await updateUserStatusApi(id, { isActive: !current }).send()
    toast.success(!current ? '已启用用户' : '已禁用用户')
  } catch (err) {
    const msg = mapErrorMessage(err)
    toast.error(msg)
    throw err
  }
}

export async function createUserService(data: {
  email: string
  name?: string
  password: string
  role: 'ADMIN' | 'USER'
}): Promise<{ success: boolean; error?: string }> {
  try {
    await createUserApi(data).send()
    toast.success('创建用户成功')
    return { success: true }
  } catch (err) {
    const msg = mapErrorMessage(err)
    toast.error(msg)
    return { success: false, error: msg }
  }
}

export async function updateUserService(
  id: string,
  data: { name?: string; role?: 'ADMIN' | 'USER'; updatedAt?: string },
): Promise<{ success: boolean; conflict?: boolean; error?: string }> {
  try {
    await updateUserApi(id, data).send()
    toast.success('修改成功')
    return { success: true }
  } catch (err) {
    if (isConflict(err)) {
      toast.error('数据已被他人修改，请刷新后重试')
      return { success: false, conflict: true }
    }
    const msg = mapErrorMessage(err)
    toast.error(msg)
    return { success: false, error: msg }
  }
}

export async function deleteUserService(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await deleteUserApi(id).send()
    toast.success('用户已删除')
    return { success: true }
  } catch (err) {
    if (isForbidden(err)) {
      toast.error('无权限执行此操作')
      return { success: false, error: '无权限执行此操作' }
    }
    const msg = mapErrorMessage(err)
    toast.error(msg)
    return { success: false, error: msg }
  }
}

export async function resetUserPassword(
  id: string,
  newPassword: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await resetPasswordApi(id, { newPassword }).send()
    toast.success('密码已重置')
    return { success: true }
  } catch (err) {
    const msg = mapErrorMessage(err)
    toast.error(msg)
    return { success: false, error: msg }
  }
}

export async function assignUserRole(
  id: string,
  role: 'ADMIN' | 'USER',
): Promise<{ success: boolean; error?: string }> {
  try {
    await assignRoleApi(id, { role }).send()
    toast.success('角色分配成功')
    return { success: true }
  } catch (err) {
    const msg = mapErrorMessage(err)
    toast.error(msg)
    return { success: false, error: msg }
  }
}

export async function fetchUser(id: string): Promise<AdminUserResponse> {
  try {
    return await getUserApi(id).send()
  } catch (err) {
    const msg = mapErrorMessage(err)
    toast.error(msg)
    throw err
  }
}
