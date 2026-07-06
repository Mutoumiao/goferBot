import { ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import type { FastifyRequest } from 'fastify'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { isAdminOnlyPath } from '../../common/utils/api-path.js'
import { ADMIN_ACCESS_COOKIE, WEB_ACCESS_COOKIE } from '../cookie.helper.js'
import { accountDisabledError, tokenRevokedError } from '../errors.js'
import { AuthRepository } from '../repositories/auth.repository.js'
import type { AuthApp } from '../types/auth-app.type.js'

type JwtPayload = {
  sub: string
  email: string
  sessionId: string
  app: AuthApp
  iat?: number
  exp?: number
}

const APP_CONTEXT_WEB: AuthApp = 'web'
const APP_CONTEXT_ADMIN: AuthApp = 'admin'
const HEADER_APP_CONTEXT = 'x-app-context'

function getAppForRequest(request: FastifyRequest): AuthApp {
  const path = request.routeOptions?.url ?? request.url?.split('?')[0] ?? '/'

  if (isAdminOnlyPath(path)) {
    return APP_CONTEXT_ADMIN
  }

  const headerApp = request.headers[HEADER_APP_CONTEXT] as AuthApp | undefined
  if (headerApp && [APP_CONTEXT_ADMIN, APP_CONTEXT_WEB].includes(headerApp)) return headerApp

  return APP_CONTEXT_WEB
}

function extractTokenFromAnyCookie(request: FastifyRequest): string | null {
  const cookies = (request.cookies ?? {}) as Record<string, string | undefined>
  return cookies[ADMIN_ACCESS_COOKIE] ?? cookies[WEB_ACCESS_COOKIE] ?? null
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
          return extractTokenFromAnyCookie(req)
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

    const requestApp = getAppForRequest(request)
    const tokenApp = payload.app

    if (tokenApp && requestApp !== tokenApp) {
      this.logger.warn(
        `App mismatch: request path requires ${requestApp} but token issued for ${tokenApp}`,
      )
      throw new ForbiddenException({ code: 'APP_MISMATCH', message: '无效的应用令牌' })
    }

    const app = tokenApp ?? requestApp
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
