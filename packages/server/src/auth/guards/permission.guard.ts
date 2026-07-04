import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { PermissionService } from '../../modules/admin/services/permission.service.js'
import { PERMISSION_KEY } from '../decorators/permission.decorator.js'
import type { AuthApp } from '../types/auth-app.type.js'

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private permissionService: PermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true
    }

    const request = context.switchToHttp().getRequest()
    const user = request.user

    if (!user?.id) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: '无权访问',
      })
    }

    const app = (request.user?.app ?? 'admin') as AuthApp
    const hasPermission = await this.permissionService.hasAnyPermission(
      user.id,
      requiredPermissions,
      app,
    )

    if (!hasPermission) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: '无权访问该资源',
      })
    }

    return true
  }
}
