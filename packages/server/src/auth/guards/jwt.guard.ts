import { ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import type { FastifyRequest } from 'fastify'
import { AuthRedisService } from '../auth-redis.service.js'
import { ADMIN_ACCESS_COOKIE, WEB_ACCESS_COOKIE } from '../cookie.helper.js'

function getCookieNameByPath(path: string): string {
  if (path.startsWith('/admin/') || path.startsWith('/auth/admin/')) {
    return ADMIN_ACCESS_COOKIE
  }
  return WEB_ACCESS_COOKIE
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(@Inject(AuthRedisService) private readonly authRedis: AuthRedisService) {
    super()
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>()
    const path = request.routeOptions?.url ?? request.url?.split('?')[0] ?? '/'
    const cookieName = getCookieNameByPath(path)
    const token = request.cookies?.[cookieName]

    if (token) {
      const isBlacklisted = await this.authRedis.isTokenBlacklisted(token)
      if (isBlacklisted) {
        throw new UnauthorizedException('令牌已失效')
      }
    }

    return super.canActivate(context) as Promise<boolean>
  }

  handleRequest<TUser = Express.User>(err: Error | null, user: TUser | false): TUser {
    if (err || !user) {
      throw err || new UnauthorizedException('未登录或令牌已过期')
    }
    return user
  }
}
