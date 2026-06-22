import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  fetchUsers,
  toggleUserStatus,
  createUserService,
  updateUserService,
  deleteUserService,
  resetUserPassword,
  assignUserRole,
  fetchUser,
} from '@/features/users/services'
import { toast } from 'sonner'

const mockListUsers = vi.fn()
const mockUpdateUserStatus = vi.fn()
const mockCreateUser = vi.fn()
const mockUpdateUser = vi.fn()
const mockDeleteUser = vi.fn()
const mockResetPassword = vi.fn()
const mockAssignRole = vi.fn()
const mockGetUser = vi.fn()

vi.mock('@/api/admin', () => ({
  listUsers: (q: unknown) => ({ send: () => mockListUsers(q) }),
  updateUserStatus: (id: string, d: unknown) => ({ send: () => mockUpdateUserStatus(id, d) }),
  createUser: (d: unknown) => ({ send: () => mockCreateUser(d) }),
  updateUser: (id: string, d: unknown) => ({ send: () => mockUpdateUser(id, d) }),
  deleteUser: (id: string) => ({ send: () => mockDeleteUser(id) }),
  resetPassword: (id: string, d: unknown) => ({ send: () => mockResetPassword(id, d) }),
  assignRole: (id: string, d: unknown) => ({ send: () => mockAssignRole(id, d) }),
  getUser: (id: string) => ({ send: () => mockGetUser(id) }),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/utils/error-mapper', () => ({
  mapErrorMessage: (err: unknown) => (err instanceof Error ? err.message : '操作失败'),
  isConflict: (err: unknown) =>
    typeof err === 'object' && err !== null && 'status' in err && (err as { status?: number }).status === 409,
  isForbidden: (err: unknown) =>
    typeof err === 'object' && err !== null && 'status' in err && (err as { status?: number }).status === 403,
}))

describe('users services', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetchUsers delegates to api', async () => {
    const expected = { items: [], total: 0 }
    mockListUsers.mockResolvedValueOnce(expected)
    const result = await fetchUsers({ page: 1, pageSize: 10 })
    expect(result).toEqual(expected)
    expect(mockListUsers).toHaveBeenCalledWith({ page: 1, pageSize: 10 })
  })

  it('fetchUsers throws and toasts on error', async () => {
    mockListUsers.mockRejectedValueOnce(new Error('offline'))
    await expect(fetchUsers({ page: 1, pageSize: 10 })).rejects.toThrow()
    expect(toast.error).toHaveBeenCalled()
  })

  it('toggleUserStatus flips isActive', async () => {
    mockUpdateUserStatus.mockResolvedValueOnce(undefined)
    await toggleUserStatus('u1', true)
    expect(mockUpdateUserStatus).toHaveBeenCalledWith('u1', { isActive: false })
    expect(toast.success).toHaveBeenCalledWith('已禁用用户')
  })

  it('createUserService returns success', async () => {
    mockCreateUser.mockResolvedValueOnce(undefined)
    const r = await createUserService({ email: 'a@b.com', password: 'pwd', role: 'USER' })
    expect(r.success).toBe(true)
  })

  it('updateUserService detects conflict', async () => {
    mockUpdateUser.mockRejectedValueOnce({ status: 409 })
    const r = await updateUserService('u1', { name: 'x' })
    expect(r.success).toBe(false)
    expect(r.conflict).toBe(true)
  })

  it('deleteUserService detects forbidden', async () => {
    mockDeleteUser.mockRejectedValueOnce({ status: 403 })
    const r = await deleteUserService('u1')
    expect(r.success).toBe(false)
    expect(r.error).toBe('无权限执行此操作')
  })

  it('resetUserPassword / assignUserRole / fetchUser forward', async () => {
    mockResetPassword.mockResolvedValueOnce(undefined)
    expect((await resetUserPassword('u1', 'newpwd')).success).toBe(true)

    mockAssignRole.mockResolvedValueOnce(undefined)
    expect((await assignUserRole('u1', 'ADMIN')).success).toBe(true)

    mockGetUser.mockResolvedValueOnce({ id: 'u1' })
    expect(await fetchUser('u1')).toEqual({ id: 'u1' })

    mockGetUser.mockRejectedValueOnce(new Error('x'))
    expect(await fetchUser('miss')).toBeNull()
  })
})
