import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createRoleService,
  deleteRoleService,
  editRoleService,
  fetchPermissions,
  fetchRole,
  fetchRoles,
  updateRoleService,
} from '@/features/roles/services'

const mockListRoles = vi.fn()
const mockListPermissions = vi.fn()
const mockCreateRole = vi.fn()
const mockUpdateRole = vi.fn()
const mockDeleteRole = vi.fn()
const mockGetRole = vi.fn()

vi.mock('@/api/role', () => ({
  listRoles: () => ({ send: mockListRoles }),
  listPermissions: () => ({ send: mockListPermissions }),
  createRole: (d: unknown) => ({ send: () => mockCreateRole(d) }),
  updateRole: (id: string, d: unknown) => ({ send: () => mockUpdateRole(id, d) }),
  deleteRole: (id: string) => ({ send: () => mockDeleteRole(id) }),
  getRole: (id: string) => ({ send: () => mockGetRole(id) }),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/utils/error-mapper', () => ({
  mapErrorMessage: (err: unknown) => (err instanceof Error ? err.message : '操作失败'),
}))

describe('roles services', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetchRoles returns list and logs toast on error', async () => {
    mockListRoles.mockResolvedValueOnce([{ code: 'admin', name: '管理员' }])
    const list = await fetchRoles()
    expect(list.length).toBe(1)

    mockListRoles.mockRejectedValueOnce(new Error('boom'))
    const empty = await fetchRoles()
    expect(empty).toEqual([])
    expect(toast.error).toHaveBeenCalledTimes(1)
  })

  it('fetchPermissions throws when api fails (no mock fallback)', async () => {
    mockListPermissions.mockRejectedValueOnce(new Error('offline'))
    await expect(fetchPermissions()).rejects.toThrow()
    expect(toast.error).toHaveBeenCalled()
  })

  it('createRoleService returns success/error', async () => {
    mockCreateRole.mockResolvedValueOnce(undefined)
    const r1 = await createRoleService({ code: 'auditor', name: '审计员' })
    expect(r1.success).toBe(true)
    expect(toast.success).toHaveBeenCalledWith('创建角色成功')

    mockCreateRole.mockRejectedValueOnce(new Error('conflict'))
    const r2 = await createRoleService({ code: 'dup', name: 'Dup' })
    expect(r2.success).toBe(false)
    expect(r2.error).toBeTruthy()
  })

  it('editRoleService / updateRoleService / deleteRoleService / fetchRole forward to api', async () => {
    mockUpdateRole.mockResolvedValueOnce(undefined)
    expect((await editRoleService('admin', { name: 'n' })).success).toBe(true)
    expect((await updateRoleService('admin', {})).success).toBe(true)

    mockDeleteRole.mockResolvedValueOnce(undefined)
    expect((await deleteRoleService('admin')).success).toBe(true)

    mockGetRole.mockResolvedValueOnce({ code: 'admin' })
    expect(await fetchRole('admin')).toEqual({ code: 'admin' })

    mockGetRole.mockRejectedValueOnce(new Error('not found'))
    await expect(fetchRole('x')).rejects.toThrow()
    expect(toast.error).toHaveBeenCalled()
  })
})
