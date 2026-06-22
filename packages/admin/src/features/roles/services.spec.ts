import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  fetchRoles,
  fetchPermissions,
  createRoleService,
  editRoleService,
  updateRoleService,
  deleteRoleService,
  fetchRole,
} from '@/features/roles/services'
import { toast } from 'sonner'

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
    mockListRoles.mockResolvedValueOnce([{ id: '1', name: 'ADMIN' }])
    const list = await fetchRoles()
    expect(list.length).toBe(1)

    mockListRoles.mockRejectedValueOnce(new Error('boom'))
    const empty = await fetchRoles()
    expect(empty).toEqual([])
    expect(toast.error).toHaveBeenCalledTimes(1)
  })

  it('fetchPermissions falls back to mock', async () => {
    mockListPermissions.mockRejectedValueOnce(new Error('offline'))
    const list = await fetchPermissions()
    expect(list.length).toBeGreaterThan(0)
    expect(list.some((p: { key: string }) => p.key === 'user:read')).toBe(true)
  })

  it('createRoleService returns success/error', async () => {
    mockCreateRole.mockResolvedValueOnce(undefined)
    const r1 = await createRoleService({ name: 'NewRole', permissions: ['user:read'] })
    expect(r1.success).toBe(true)
    expect(toast.success).toHaveBeenCalledWith('创建角色成功')

    mockCreateRole.mockRejectedValueOnce(new Error('conflict'))
    const r2 = await createRoleService({ name: 'Dup', permissions: [] })
    expect(r2.success).toBe(false)
    expect(r2.error).toBeTruthy()
  })

  it('editRoleService / updateRoleService / deleteRoleService / fetchRole forward to api', async () => {
    mockUpdateRole.mockResolvedValueOnce(undefined)
    expect((await editRoleService('1', { name: 'n' })).success).toBe(true)
    expect((await updateRoleService('1', {})).success).toBe(true)

    mockDeleteRole.mockResolvedValueOnce(undefined)
    expect((await deleteRoleService('1')).success).toBe(true)

    mockGetRole.mockResolvedValueOnce({ id: '1' })
    expect(await fetchRole('1')).toEqual({ id: '1' })

    mockGetRole.mockRejectedValueOnce(new Error('not found'))
    expect(await fetchRole('x')).toBeNull()
  })
})
