import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import type { FastifyRequest } from 'fastify'
import { getCookieNamesForApp } from '../cookie.helper.js'
import { noAuthTokenError } from '../errors.js'
import { getAppForRequest } from '../strategies/jwt.strategy.js'

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = Express.User>(
    err: Error | null,
    user: TUser | false,
    _info: unknown,
    context: ExecutionContext,
  ): TUser {
    const request = context.switchToHttp().getRequest<FastifyRequest>()
    const app = getAppForRequest(request)
    const cookies = (request.cookies ?? {}) as Record<string, string | undefined>

    if (!cookies[getCookieNamesForApp(app).accessToken]) {
      throw noAuthTokenError()
    }

    if (err || !user) {
      throw err || new UnauthorizedException('未登录或令牌已过期')
    }
    return user
  }
}
