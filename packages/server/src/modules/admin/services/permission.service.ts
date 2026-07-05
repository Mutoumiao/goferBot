import { Injectable } from '@nestjs/common'
import { AuthRedisService } from '../../../auth/auth-redis.service.js'
import type { AuthApp } from '../../../auth/types/auth-app.type.js'
import { PermissionRepository } from '../repositories/permission.repository.js'

@Injectable()
export class PermissionService {
  constructor(
    private readonly permissionRepository: PermissionRepository,
    private readonly authRedis: AuthRedisService,
  ) {}

  async getUserRoles(userId: string, app: AuthApp): Promise<string[]> {
    return this.permissionRepository.getUserRoles(userId, app)
  }

  async isSuperAdmin(userId: string): Promise<boolean> {
    const roles = await this.permissionRepository.getUserRoles(userId, 'admin')
    return roles.includes('super_admin')
  }

  async getUserPermissions(userId: string, app: AuthApp): Promise<string[]> {
    const cacheKey = `auth:permission:${userId}:${app}`
    const cached = await this.authRedis.getCachedUserPermissions(cacheKey)
    if (cached) {
      return cached
    }

    const permissions = await this.permissionRepository.getPermissionsByUserId(userId, app)
    await this.authRedis.cacheUserPermissions(cacheKey, permissions)
    return permissions
  }

  async getAllPermissions(app?: AuthApp) {
    return this.permissionRepository.getAllPermissions(app)
  }

  async hasPermission(userId: string, permissionCode: string, app: AuthApp): Promise<boolean> {
    if (await this.isSuperAdmin(userId)) {
      return true
    }
    const permissions = await this.getUserPermissions(userId, app)
    return permissions.includes(permissionCode)
  }

  async hasAnyPermission(
    userId: string,
    permissionCodes: string[],
    app: AuthApp,
  ): Promise<boolean> {
    if (await this.isSuperAdmin(userId)) {
      return true
    }
    const permissions = await this.getUserPermissions(userId, app)
    return permissionCodes.some((code) => permissions.includes(code))
  }

  async hasAllPermissions(
    userId: string,
    permissionCodes: string[],
    app: AuthApp,
  ): Promise<boolean> {
    if (await this.isSuperAdmin(userId)) {
      return true
    }
    const permissions = await this.getUserPermissions(userId, app)
    return permissionCodes.every((code) => permissions.includes(code))
  }

  async invalidateUserPermissions(userId: string, app?: AuthApp): Promise<void> {
    if (app) {
      const cacheKey = `auth:permission:${userId}:${app}`
      await this.authRedis.invalidateUserPermissions(cacheKey)
    } else {
      const adminKey = `auth:permission:${userId}:admin`
      const webKey = `auth:permission:${userId}:web`
      await this.authRedis.invalidateUserPermissions(adminKey)
      await this.authRedis.invalidateUserPermissions(webKey)
    }
  }

  async invalidateAllPermissions(): Promise<void> {
    await this.authRedis.invalidateAllUserPermissions()
  }
}
