import { createHash, randomUUID } from 'node:crypto'
import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { ADMIN_REFRESH_COOKIE, WEB_REFRESH_COOKIE } from '@goferbot/data'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { AppException } from '../lib/app-error.js'
import { PermissionService } from '../modules/admin/services/permission.service.js'
import { UserService } from '../modules/user/user.service.js'
import { getAuthPolicy } from './auth-policy.js'
import { AuthRedisService } from './auth-redis.service.js'
import { CaptchaService } from './captcha.service.js'
import { CookieHelper } from './cookie.helper.js'
import { PasswordEncryptionService } from './crypto/password-encryption.service.js'
import {
  accountDisabledError,
  invalidRefreshTokenError,
  invalidTokenTypeError,
  invitationCodeExpiredError,
  invitationCodeInvalidError,
  invitationCodeMaxUsesError,
  invitationCodeUsedError,
  noAdminRoleError,
  noAppRoleError,
  sessionRevokedError,
  superAdminProtectedError,
  tokenNotFoundError,
  tokenReplayError,
  tokenRevokedError,
  userNotFoundError,
} from './errors.js'
import { AuthRepository } from './repositories/auth.repository.js'
import type { AuthApp } from './types/auth-app.type.js'
import type { TokenPair } from './types/token-pair.type.js'

export interface JwtAccessPayload {
  sub: string
  email: string
  sessionId: string
  app: AuthApp
  type: 'access'
}

export interface JwtRefreshPayload {
  sub: string
  email: string
  sessionId: string
  app: AuthApp
  jti: string
  type: 'refresh'
}

export interface LoginMeta {
  userAgent?: string
  ip?: string
}

interface ValidatedInvitation {
  id?: string
  isTestCode: boolean
  type?: 'standard' | 'multi'
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly cookieHelper: CookieHelper,
    private readonly authRepository: AuthRepository,
    private readonly authRedis: AuthRedisService,
    private readonly rsaService: PasswordEncryptionService,
    readonly _captchaService: CaptchaService,
    private readonly userService: UserService,
    private readonly permissionService: PermissionService,
  ) {}

  async webRegister(
    email: string,
    password: string,
    invitationCode: string,
    name?: string,
    meta?: LoginMeta,
  ) {
    const validated = await this.validateInvitationCode(invitationCode)

    const user = await this.userService.create(email, password, name)

    if (validated.id && !validated.isTestCode) {
      if (validated.type === 'multi') {
        await this.authRepository.useMultiInvitationCode(validated.id)
      } else {
        await this.authRepository.useStandardInvitationCode(validated.id, user.id)
      }
    }

    const tokens = await this.createSession(user.id, user.email, 'web', meta)
    await this.authRepository.updateLastLogin(user.id)

    return { user, ...tokens }
  }

  async adminLogin(email: string, password: string, meta?: LoginMeta) {
    const user = await this.userService.validatePassword(email, password)

    if (!user.isActive) {
      throw accountDisabledError()
    }

    const roles = await this.authRepository.getRolesForUserByApp(user.id, 'admin')
    const roleCodes = roles.map((r) => r.role)
    const isAdmin = roleCodes.includes('admin') || roleCodes.includes('super_admin')

    if (!isAdmin) {
      throw noAdminRoleError()
    }

    const authMethodEnabled = await this.authRepository.isAuthMethodEnabled('admin', 'password')
    if (!authMethodEnabled) {
      throw accountDisabledError()
    }

    const policy = getAuthPolicy('admin')
    if (policy.requireRolesToLogin && roles.length === 0) {
      throw noAppRoleError('admin')
    }

    const tokens = await this.createSession(user.id, user.email, 'admin', meta)
    await this.authRepository.updateLastLogin(user.id)
    const permissions = await this.permissionService.getUserPermissions(user.id, 'admin')

    return { user: { ...user, roles: roleCodes, permissions }, ...tokens }
  }

  async webLogin(email: string, password: string, meta?: LoginMeta) {
    const user = await this.userService.validatePassword(email, password)

    if (!user.isActive) {
      throw accountDisabledError()
    }

    const authMethodEnabled = await this.authRepository.isAuthMethodEnabled('web', 'password')
    if (!authMethodEnabled) {
      throw accountDisabledError()
    }

    const roles = await this.authRepository.getRolesForUserByApp(user.id, 'web')
    const policy = getAuthPolicy('web')
    if (policy.requireRolesToLogin && roles.length === 0) {
      throw noAppRoleError('web')
    }

    const tokens = await this.createSession(user.id, user.email, 'web', meta)
    await this.authRepository.updateLastLogin(user.id)

    return { user: { ...user, roles: roles.map((r) => r.role) }, ...tokens }
  }

  async refresh(app: AuthApp, refreshTokenCookie: string) {
    try {
      const payload = this.jwtService.verify<JwtRefreshPayload>(refreshTokenCookie, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      })

      if (payload.type !== 'refresh') {
        throw invalidTokenTypeError()
      }

      if (payload.app !== app) {
        throw invalidTokenTypeError()
      }

      const jtiHash = this.hashJti(payload.jti)
      const tokenRecord = await this.authRepository.findRefreshTokenByJtiHash(jtiHash)

      if (!tokenRecord) {
        throw tokenNotFoundError()
      }

      if (tokenRecord.usedAt) {
        await this.authRepository.revokeSession(tokenRecord.sessionId, 'token_replay_detected')
        throw tokenReplayError()
      }

      if (tokenRecord.revokedAt) {
        throw tokenRevokedError()
      }

      if (tokenRecord.session.revokedAt) {
        throw sessionRevokedError()
      }

      const user = await this.userService.findById(payload.sub)
      if (!user) {
        throw userNotFoundError()
      }

      if (!user.isActive) {
        throw accountDisabledError()
      }

      const roles = await this.authRepository.getRolesForUserByApp(user.id, payload.app)
      const policy = getAuthPolicy(payload.app)
      if (policy.requireRolesToLogin && roles.length === 0) {
        await this.authRepository.revokeSession(
          tokenRecord.sessionId,
          `${payload.app}_role_missing`,
        )
        throw noAppRoleError(payload.app)
      }

      const newJti = this.generateJti()
      const newJtiHash = this.hashJti(newJti)

      const newRefreshToken = this.signRefreshToken(
        payload.sub,
        user.email,
        payload.sessionId,
        payload.app,
        newJti,
      )

      const newTokenRecord = await this.authRepository.insertRefreshToken({
        sessionId: payload.sessionId,
        jtiHash: newJtiHash,
        parentTokenId: tokenRecord.id,
      })

      const marked = await this.authRepository.markRefreshTokenUsed(jtiHash, newTokenRecord.id)
      if (!marked) {
        await this.authRepository.revokeSession(tokenRecord.sessionId, 'token_replay_detected')
        throw tokenReplayError()
      }

      const accessToken = this.signAccessToken(
        payload.sub,
        user.email,
        payload.sessionId,
        payload.app,
      )

      return {
        accessToken,
        refreshToken: newRefreshToken,
        sessionId: payload.sessionId,
      }
    } catch (err) {
      if (err instanceof AppException) {
        throw err
      }
      const isDev = process.env.NODE_ENV === 'development'
      throw invalidRefreshTokenError(isDev && err instanceof Error ? err.message : undefined)
    }
  }

  async refreshToken(app: AuthApp, req: FastifyRequest, res: FastifyReply) {
    const refreshCookieName = app === 'admin' ? ADMIN_REFRESH_COOKIE : WEB_REFRESH_COOKIE
    const refreshToken = req.cookies?.[refreshCookieName]
    if (!refreshToken) {
      this.cookieHelper.clearAuthCookies(res, app)
      throw new BadRequestException({ code: 'REFRESH_TOKEN_MISSING', message: '未找到刷新令牌' })
    }
    try {
      const result = await this.refresh(app, refreshToken)
      this.cookieHelper.setAuthCookies(res, result.accessToken, result.refreshToken, app)
      return { success: true }
    } catch (err) {
      this.cookieHelper.clearAuthCookies(res, app)
      throw err
    }
  }

  async logout(sessionId: string, reply: FastifyReply, app: AuthApp): Promise<void> {
    await this.authRepository.revokeSession(sessionId, 'logout')
    this.cookieHelper.clearAuthCookies(reply, app)
    const session = await this.authRepository.findSessionById(sessionId)
    if (session?.userId) {
      await this.authRedis.invalidateUserCache(session.userId)
    }
  }

  async me(userId: string, app: AuthApp) {
    const user = await this.userService.findById(userId)
    if (!user) {
      throw userNotFoundError()
    }
    const roles = await this.authRepository.getRolesForUserByApp(userId, app)
    const roleCodes = roles.map((r) => r.role)
    const permissions = await this.permissionService.getUserPermissions(userId, app)
    return { ...user, roles: roleCodes, permissions, app }
  }

  async changePassword(
    sessionId: string,
    userId: string,
    oldPassword: string,
    newPassword: string,
  ) {
    const session = await this.authRepository.findValidSession(sessionId)
    if (!session || session.userId !== userId) {
      throw sessionRevokedError()
    }

    const user = await this.userService.findById(userId)
    if (!user) {
      throw userNotFoundError()
    }

    const updated = await this.userService.updatePassword(userId, oldPassword, newPassword)
    await this.authRedis.invalidateUserCache(userId)

    return updated
  }

  async getAllSessions(userId: string) {
    return this.authRepository.getUserSessions(userId)
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const session = await this.authRepository.findSessionById(sessionId)
    if (!session || session.userId !== userId) {
      throw sessionRevokedError()
    }
    await this.authRepository.revokeSession(sessionId, 'user_revoked')
    await this.authRedis.invalidateUserCache(userId)
  }

  async revokeAllSessions(userId: string): Promise<void> {
    const user = await this.userService.findById(userId)
    if (!user) {
      throw userNotFoundError()
    }

    const isSuperAdmin = await this.authRepository.userHasRole(userId, 'admin', 'super_admin')
    if (isSuperAdmin) {
      throw superAdminProtectedError()
    }

    await this.authRepository.revokeAllSessionsForUser(userId, 'user_revoked_all')
    await this.authRedis.invalidateUserCache(userId)
  }

  async revokeOtherSessions(userId: string, currentSessionId: string): Promise<void> {
    await this.authRepository.revokeOtherSessions(userId, currentSessionId, 'user_revoked_others')
    await this.authRedis.invalidateUserCache(userId)
  }

  async validateInvitationCode(code: string): Promise<ValidatedInvitation> {
    const testCodes = this.configService.get<string>('TEST_INVITATION_CODES')
    if (testCodes) {
      const testCodeList = testCodes
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean)
      if (testCodeList.includes(code)) {
        return { isTestCode: true }
      }
    }

    const invitation = await this.authRepository.findInvitationCodeByCode(code)
    if (!invitation) {
      throw invitationCodeInvalidError()
    }

    if (invitation.expiresAt && invitation.expiresAt < new Date()) {
      throw invitationCodeExpiredError()
    }

    if (invitation.type === 'standard') {
      if (invitation.usedBy) {
        throw invitationCodeUsedError()
      }
      if (
        invitation.maxUses !== null &&
        invitation.maxUses !== undefined &&
        invitation.usedCount >= invitation.maxUses
      ) {
        throw invitationCodeMaxUsesError()
      }
      return { id: invitation.id, isTestCode: false, type: 'standard' as const }
    }

    if (
      invitation.maxUses !== null &&
      invitation.maxUses !== undefined &&
      invitation.usedCount >= invitation.maxUses
    ) {
      throw invitationCodeMaxUsesError()
    }

    return { id: invitation.id, isTestCode: false, type: 'multi' as const }
  }

  async blacklistToken(token: string): Promise<void> {
    const expiresIn = this.configService.get<string>('JWT_EXPIRES_IN') || '2h'
    const ttlSeconds = this.parseExpiresInToSeconds(expiresIn)
    await this.authRedis.blacklistToken(token, ttlSeconds)
  }

  async invalidateUserCache(userId: string): Promise<void> {
    await this.authRedis.invalidateUserCache(userId)
  }

  decryptPassword(encryptedPassword: string): string {
    return this.rsaService.decrypt(encryptedPassword)
  }

  private hashJti(jti: string): string {
    return createHash('sha256').update(jti).digest('hex')
  }

  private generateJti(): string {
    return randomUUID()
  }

  private signAccessToken(userId: string, email: string, sessionId: string, app: AuthApp): string {
    const payload: JwtAccessPayload = {
      sub: userId,
      email,
      sessionId,
      app,
      type: 'access',
    }

    const expiresIn = this.validateExpiresIn(
      this.configService.get<string>('JWT_EXPIRES_IN') || '15m',
      'JWT_EXPIRES_IN',
    )

    return this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      expiresIn,
    })
  }

  private signRefreshToken(
    userId: string,
    email: string,
    sessionId: string,
    app: AuthApp,
    jti: string,
  ): string {
    const payload: JwtRefreshPayload = {
      sub: userId,
      email,
      sessionId,
      app,
      jti,
      type: 'refresh',
    }

    const expiresIn = this.validateExpiresIn(
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d',
      'JWT_REFRESH_EXPIRES_IN',
    )

    return this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn,
    })
  }

  private async createSession(
    userId: string,
    email: string,
    app: AuthApp,
    meta?: LoginMeta,
  ): Promise<TokenPair & { sessionId: string }> {
    const jti = this.generateJti()
    const jtiHash = this.hashJti(jti)

    const session = await this.authRepository.createSessionWithTokenPair(userId, app, jtiHash, meta)

    const accessToken = this.signAccessToken(userId, email, session.id, app)
    const refreshToken = this.signRefreshToken(userId, email, session.id, app, jti)

    return { accessToken, refreshToken, sessionId: session.id }
  }

  async verifyPassword(userId: string, password: string): Promise<boolean> {
    return this.userService.verifyPassword(userId, password)
  }

  private parseExpiresInToSeconds(expiresIn: string): number {
    const match = expiresIn.match(/^(\d+)([smhd])$/)
    if (!match) return 7200
    const value = parseInt(match[1], 10)
    const unit = match[2]
    const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 }
    return value * (multipliers[unit] || 3600)
  }

  private validateExpiresIn(value: string, configName: string): string {
    if (!/^(\d+)([smhd])$/.test(value)) {
      this.logger.warn(
        `${configName}="${value}" 格式无效，预期为 "数字+单位"（如 15m、2h、7d）。回退到安全默认值。`,
      )
      return configName === 'JWT_EXPIRES_IN' ? '15m' : '7d'
    }
    return value
  }
}
