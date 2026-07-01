import { Injectable } from '@nestjs/common'
import { AuthRedisService } from '../auth-redis.service.js'
import { PermissionRepository } from '../repositories/permission.repository.js'
import type { AuthApp } from '../types/auth-app.type.js'

@Injectable()
export class PermissionService {
  constructor(
    private readonly permissionRepository: PermissionRepository,
    private readonly authRedis: AuthRedisService,
  ) {}

  async getUserPermissions(userId: string, app: AuthApp): Promise<string[]> {
    const cacheKey = `${userId}:${app}`
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
      const cacheKey = `${userId}:${app}`
      await this.authRedis.invalidateUserPermissions(cacheKey)
    } else {
      const adminKey = `${userId}:admin`
      const webKey = `${userId}:web`
      await this.authRedis.invalidateUserPermissions(adminKey)
      await this.authRedis.invalidateUserPermissions(webKey)
    }
  }

  async invalidateAllPermissions(): Promise<void> {
    await this.authRedis.invalidateAllUserPermissions()
  }

  private async isSuperAdmin(userId: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId, 'admin')
    return permissions.includes('*') || permissions.length >= 20
  }
}
