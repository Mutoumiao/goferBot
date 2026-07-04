import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { FastifyRequest } from 'fastify'
import { appMismatchError } from '../../auth/errors.js'
import {
  ALLOW_APP_KEY,
  type AllowAppMode,
  IS_PUBLIC_KEY,
} from '../decorators/allow-app.decorator.js'

type PathCategory = 'public' | 'admin-only' | 'admin-auth' | 'web-auth' | 'web-biz' | 'common'

function categorizePath(path: string): PathCategory {
  if (
    path === '/auth/web/login' ||
    path === '/auth/admin/login' ||
    path === '/auth/web/register' ||
    path === '/auth/public-key' ||
    path.startsWith('/captcha/')
  ) {
    return 'public'
  }

  if (path === '/auth/admin/refresh' || path === '/auth/admin/logout') {
    return 'admin-auth'
  }

  if (path === '/auth/web/refresh' || path === '/auth/web/logout') {
    return 'web-auth'
  }

  if (path.startsWith('/admin/')) {
    return 'admin-only'
  }

  if (
    path.startsWith('/chat/') ||
    path.startsWith('/knowledge-base/') ||
    path.startsWith('/session/') ||
    path.startsWith('/companion/')
  ) {
    return 'web-biz'
  }

  if (path === '/auth/me' || path.startsWith('/user/') || path.startsWith('/settings/')) {
    return 'common'
  }

  return 'common'
}

@Injectable()
export class AppGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>()
    const path = request.routeOptions?.url ?? request.url?.split('?')[0] ?? '/'

    const allowApp = this.reflector.getAllAndOverride<AllowAppMode | undefined>(ALLOW_APP_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    const category = allowApp ? this.modeToCategory(allowApp) : categorizePath(path)

    if (category === 'public' || isPublic) {
      return true
    }

    const user = (request as unknown as { user?: { app?: string } }).user
    if (!user || !user.app) {
      return true
    }

    const tokenApp = user.app

    switch (category) {
      case 'admin-only':
      case 'admin-auth':
        if (tokenApp !== 'admin') {
          throw appMismatchError()
        }
        break
      case 'web-auth':
      case 'web-biz':
        if (tokenApp !== 'web') {
          throw appMismatchError()
        }
        break
      case 'common':
        if (tokenApp !== 'web' && tokenApp !== 'admin') {
          throw appMismatchError()
        }
        break
    }

    return true
  }

  private modeToCategory(mode: AllowAppMode): PathCategory {
    switch (mode) {
      case 'public':
        return 'public'
      case 'admin':
        return 'admin-only'
      case 'web':
        return 'web-biz'
      case 'both':
        return 'common'
      default:
        return 'common'
    }
  }
}
