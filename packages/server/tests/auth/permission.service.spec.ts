import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionService } from '../../src/modules/admin/services/permission.service.js'

const mockPermissionRepository = {
  getPermissionsByUserId: vi.fn(),
  getAllPermissions: vi.fn(),
  getUserRoles: vi.fn(),
}

const mockAuthRedis = {
  getCachedUserPermissions: vi.fn(),
  cacheUserPermissions: vi.fn(),
  invalidateUserPermissions: vi.fn(),
  invalidateAllUserPermissions: vi.fn(),
}

describe('PermissionService', () => {
  let service: PermissionService

  beforeEach(() => {
    vi.clearAllMocks()
    mockPermissionRepository.getUserRoles.mockResolvedValue([])
    service = new PermissionService(mockPermissionRepository as never, mockAuthRedis as never)
  })

  describe('getUserPermissions', () => {
    it('returns cached permissions when available', async () => {
      mockAuthRedis.getCachedUserPermissions.mockResolvedValue(['dashboard:read', 'users:read'])

      const result = await service.getUserPermissions('user1', 'admin')

      expect(result).toEqual(['dashboard:read', 'users:read'])
      expect(mockPermissionRepository.getPermissionsByUserId).not.toHaveBeenCalled()
    })

    it('fetches from repository when cache is empty', async () => {
      mockAuthRedis.getCachedUserPermissions.mockResolvedValue(null)
      mockPermissionRepository.getPermissionsByUserId.mockResolvedValue([
        'dashboard:read',
        'users:read',
      ])

      const result = await service.getUserPermissions('user1', 'admin')

      expect(result).toEqual(['dashboard:read', 'users:read'])
      expect(mockPermissionRepository.getPermissionsByUserId).toHaveBeenCalledWith('user1', 'admin')
      expect(mockAuthRedis.cacheUserPermissions).toHaveBeenCalled()
    })
  })

  describe('hasPermission', () => {
    it('returns true when user has the permission', async () => {
      mockAuthRedis.getCachedUserPermissions.mockResolvedValue(['dashboard:read', 'users:read'])

      const result = await service.hasPermission('user1', 'users:read', 'admin')

      expect(result).toBe(true)
    })

    it('returns false when user does not have the permission', async () => {
      mockAuthRedis.getCachedUserPermissions.mockResolvedValue(['dashboard:read'])

      const result = await service.hasPermission('user1', 'users:read', 'admin')

      expect(result).toBe(false)
    })

    it('returns true when user is super_admin regardless of cached permissions', async () => {
      mockPermissionRepository.getUserRoles.mockResolvedValue(['super_admin'])
      mockAuthRedis.getCachedUserPermissions.mockResolvedValue([])

      const result = await service.hasPermission('user1', 'users:read', 'admin')

      expect(result).toBe(true)
    })
  })

  describe('hasAnyPermission', () => {
    it('returns true when user has any of the required permissions', async () => {
      mockAuthRedis.getCachedUserPermissions.mockResolvedValue(['dashboard:read', 'users:read'])

      const result = await service.hasAnyPermission('user1', ['users:read', 'roles:read'], 'admin')

      expect(result).toBe(true)
    })

    it('returns false when user has none of the required permissions', async () => {
      mockAuthRedis.getCachedUserPermissions.mockResolvedValue(['dashboard:read'])

      const result = await service.hasAnyPermission('user1', ['users:read', 'roles:read'], 'admin')

      expect(result).toBe(false)
    })
  })

  describe('hasAllPermissions', () => {
    it('returns true when user has all required permissions', async () => {
      mockAuthRedis.getCachedUserPermissions.mockResolvedValue([
        'dashboard:read',
        'users:read',
        'roles:read',
      ])

      const result = await service.hasAllPermissions('user1', ['users:read', 'roles:read'], 'admin')

      expect(result).toBe(true)
    })

    it('returns false when user is missing one permission', async () => {
      mockAuthRedis.getCachedUserPermissions.mockResolvedValue(['dashboard:read', 'users:read'])

      const result = await service.hasAllPermissions('user1', ['users:read', 'roles:read'], 'admin')

      expect(result).toBe(false)
    })
  })

  describe('isSuperAdmin', () => {
    it('returns true when user has super_admin role', async () => {
      mockPermissionRepository.getUserRoles.mockResolvedValue(['super_admin'])

      const result = await service.isSuperAdmin('user1')

      expect(result).toBe(true)
      expect(mockPermissionRepository.getUserRoles).toHaveBeenCalledWith('user1', 'admin')
    })

    it('returns false when user does not have super_admin role', async () => {
      mockPermissionRepository.getUserRoles.mockResolvedValue(['admin'])

      const result = await service.isSuperAdmin('user1')

      expect(result).toBe(false)
    })
  })

  describe('invalidateUserPermissions', () => {
    it('invalidates cache for specific app', async () => {
      await service.invalidateUserPermissions('user1', 'admin')

      expect(mockAuthRedis.invalidateUserPermissions).toHaveBeenCalledWith(
        'auth:permission:user1:admin',
      )
    })

    it('invalidates cache for all apps when app is not specified', async () => {
      await service.invalidateUserPermissions('user1')

      expect(mockAuthRedis.invalidateUserPermissions).toHaveBeenCalledTimes(2)
      expect(mockAuthRedis.invalidateUserPermissions).toHaveBeenCalledWith(
        'auth:permission:user1:admin',
      )
      expect(mockAuthRedis.invalidateUserPermissions).toHaveBeenCalledWith(
        'auth:permission:user1:web',
      )
    })
  })

  describe('invalidateAllPermissions', () => {
    it('invalidates all permission caches', async () => {
      await service.invalidateAllPermissions()

      expect(mockAuthRedis.invalidateAllUserPermissions).toHaveBeenCalled()
    })
  })
})
