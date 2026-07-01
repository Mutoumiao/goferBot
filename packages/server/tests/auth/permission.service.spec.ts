import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionService } from '../../src/auth/services/permission.service.js'

const mockPermissionRepository = {
  getPermissionsByUserId: vi.fn(),
  getAllPermissions: vi.fn(),
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
    service = new PermissionService(mockPermissionRepository as never, mockAuthRedis as never)
  })

  describe('getUserPermissions', () => {
    it('returns cached permissions when available', async () => {
      mockAuthRedis.getCachedUserPermissions.mockResolvedValue(['dashboard', 'users'])

      const result = await service.getUserPermissions('user1', 'admin')

      expect(result).toEqual(['dashboard', 'users'])
      expect(mockPermissionRepository.getPermissionsByUserId).not.toHaveBeenCalled()
    })

    it('fetches from repository when cache is empty', async () => {
      mockAuthRedis.getCachedUserPermissions.mockResolvedValue(null)
      mockPermissionRepository.getPermissionsByUserId.mockResolvedValue(['dashboard', 'users'])

      const result = await service.getUserPermissions('user1', 'admin')

      expect(result).toEqual(['dashboard', 'users'])
      expect(mockPermissionRepository.getPermissionsByUserId).toHaveBeenCalledWith('user1', 'admin')
      expect(mockAuthRedis.cacheUserPermissions).toHaveBeenCalled()
    })
  })

  describe('hasPermission', () => {
    it('returns true when user has the permission', async () => {
      mockAuthRedis.getCachedUserPermissions.mockResolvedValue(['dashboard', 'users'])

      const result = await service.hasPermission('user1', 'users', 'admin')

      expect(result).toBe(true)
    })

    it('returns false when user does not have the permission', async () => {
      mockAuthRedis.getCachedUserPermissions.mockResolvedValue(['dashboard'])

      const result = await service.hasPermission('user1', 'users', 'admin')

      expect(result).toBe(false)
    })
  })

  describe('hasAnyPermission', () => {
    it('returns true when user has any of the required permissions', async () => {
      mockAuthRedis.getCachedUserPermissions.mockResolvedValue(['dashboard', 'users'])

      const result = await service.hasAnyPermission('user1', ['users', 'roles'], 'admin')

      expect(result).toBe(true)
    })

    it('returns false when user has none of the required permissions', async () => {
      mockAuthRedis.getCachedUserPermissions.mockResolvedValue(['dashboard'])

      const result = await service.hasAnyPermission('user1', ['users', 'roles'], 'admin')

      expect(result).toBe(false)
    })
  })

  describe('hasAllPermissions', () => {
    it('returns true when user has all required permissions', async () => {
      mockAuthRedis.getCachedUserPermissions.mockResolvedValue(['dashboard', 'users', 'roles'])

      const result = await service.hasAllPermissions('user1', ['users', 'roles'], 'admin')

      expect(result).toBe(true)
    })

    it('returns false when user is missing one permission', async () => {
      mockAuthRedis.getCachedUserPermissions.mockResolvedValue(['dashboard', 'users'])

      const result = await service.hasAllPermissions('user1', ['users', 'roles'], 'admin')

      expect(result).toBe(false)
    })
  })

  describe('invalidateUserPermissions', () => {
    it('invalidates cache for specific app', async () => {
      await service.invalidateUserPermissions('user1', 'admin')

      expect(mockAuthRedis.invalidateUserPermissions).toHaveBeenCalledWith('user1:admin')
    })

    it('invalidates cache for all apps when app is not specified', async () => {
      await service.invalidateUserPermissions('user1')

      expect(mockAuthRedis.invalidateUserPermissions).toHaveBeenCalledTimes(2)
      expect(mockAuthRedis.invalidateUserPermissions).toHaveBeenCalledWith('user1:admin')
      expect(mockAuthRedis.invalidateUserPermissions).toHaveBeenCalledWith('user1:web')
    })
  })

  describe('invalidateAllPermissions', () => {
    it('invalidates all permission caches', async () => {
      await service.invalidateAllPermissions()

      expect(mockAuthRedis.invalidateAllUserPermissions).toHaveBeenCalled()
    })
  })
})
