import { ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { Observable } from 'rxjs'
import type { FastifyRequest } from 'fastify'
import { AuthRedisService } from '../auth-redis.service.js'

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    @Inject(AuthRedisService) private readonly authRedis: AuthRedisService,
  ) {
    super()
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>()
    const authHeader = request.headers.authorization
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
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
