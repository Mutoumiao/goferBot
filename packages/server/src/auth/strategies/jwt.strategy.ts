import { Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import type { FastifyRequest } from 'fastify'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { ADMIN_ACCESS_COOKIE, WEB_ACCESS_COOKIE } from '../../auth/cookie.helper.js'
import { accountDisabledError, tokenRevokedError } from '../../auth/errors.js'
import { AuthRepository } from '../../auth/repositories/auth.repository.js'
import type { AuthApp } from '../../auth/types/auth-app.type.js'

type JwtPayload = {
  sub: string
  email: string
  sessionId: string
  app: AuthApp
  iat?: number
  exp?: number
}

function inferAppFromPath(path: string): AuthApp {
  if (path.startsWith('/admin/')) return 'admin'
  if (path === '/auth/admin/refresh' || path === '/auth/admin/logout') return 'admin'
  if (path === '/auth/web/refresh' || path === '/auth/web/logout') return 'web'
  if (
    path.startsWith('/chat/') ||
    path.startsWith('/knowledge-base/') ||
    path.startsWith('/session/') ||
    path.startsWith('/companion/')
  ) {
    return 'web'
  }
  return 'web'
}

function getAppForRequest(request: FastifyRequest): AuthApp {
  const path = request.routeOptions?.url ?? request.url?.split('?')[0] ?? '/'
  const headerApp = request.headers['x-app-context'] as string | undefined

  if (path === '/auth/me' || path.startsWith('/user/') || path.startsWith('/settings/')) {
    if (headerApp === 'admin') return 'admin'
    return 'web'
  }

  return inferAppFromPath(path)
}

function extractTokenFromAppCookies(request: FastifyRequest, app: AuthApp): string | null {
  const cookieName = app === 'admin' ? ADMIN_ACCESS_COOKIE : WEB_ACCESS_COOKIE
  const cookies = (request.cookies ?? {}) as Record<string, string | undefined>
  return cookies[cookieName] ?? null
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name)

  constructor(
    readonly configService: ConfigService,
    private readonly authRepository: AuthRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: FastifyRequest) => {
          const app = getAppForRequest(req)
          return extractTokenFromAppCookies(req, app)
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
      passReqToCallback: true,
    })
  }

  async validate(request: FastifyRequest, payload: JwtPayload) {
    if (!payload.sub || !payload.sessionId) {
      this.logger.warn(`JWT payload missing fields: ${JSON.stringify(payload)}`)
      throw new UnauthorizedException('无效的令牌')
    }

    const session = await this.authRepository.findValidSession(payload.sessionId)
    if (!session) {
      this.logger.warn(`Session ${payload.sessionId} revoked or not found`)
      throw tokenRevokedError()
    }

    const user = await this.authRepository.findUserById(payload.sub)
    if (!user) {
      this.logger.warn(`User ${payload.sub} not found in JWT validation`)
      throw new UnauthorizedException('用户不存在')
    }
    if (!user.isActive) {
      this.logger.warn(`Banned user ${payload.sub} attempted access`)
      throw accountDisabledError()
    }

    const app = payload.app ?? getAppForRequest(request)
    const roles = await this.authRepository.getRolesForUserByApp(user.id, app)

    void this.authRepository.updateLastSeen(payload.sessionId).catch((err) => {
      this.logger.error(`Failed to update lastSeen for session ${payload.sessionId}`, err)
    })

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      sessionId: payload.sessionId,
      app,
      roles: roles.map((r) => r.role),
    }
  }
}
