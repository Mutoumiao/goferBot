import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { FastifyRequest } from 'fastify'
import { appMismatchError } from '../../auth/errors.js'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js'
import { categorizePath } from '../utils/api-path.js'

@Injectable()
export class AppGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) { }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>()
    const path = request.routeOptions?.url ?? request.url?.split('?')[0] ?? '/'

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    const category = categorizePath(path)

    if (category === 'public' || isPublic) {
      return true
    }

    const user = (request as unknown as { user?: { app?: string } }).user
    if (!user?.app) {
      return true
    }

    const expectedApp = category === 'admin-only' ? 'admin' : 'web'
    if (user.app !== expectedApp) {
      throw appMismatchError()
    }

    return true
  }
}