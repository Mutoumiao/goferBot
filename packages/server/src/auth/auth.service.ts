import { createHash, randomUUID } from 'node:crypto'
import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { AppException } from '../lib/app-error.js'
import { UserService } from '../modules/user/user.service.js'
import { StorageService } from '../processors/storage/storage.service.js'
import { AuthRedisService } from './auth-redis.service.js'
import { AVATAR_ALLOWED_MIME_TYPES, AVATAR_EXT_MAP, AVATAR_MAX_SIZE } from './constants.js'
import { UpdateProfileDto } from './dto/update-profile.dto.js'
import {
  accountDisabledError,
  invalidRefreshTokenError,
  invalidTokenTypeError,
  noAdminRoleError,
  sessionRevokedError,
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
  sid: string
  app: AuthApp
  type: 'access'
}

export interface JwtRefreshPayload {
  sub: string
  sid: string
  app: AuthApp
  jti: string
  type: 'refresh'
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly userService: UserService,
    private readonly storageService: StorageService,
    private readonly authRedis: AuthRedisService,
    private readonly authRepository: AuthRepository,
  ) {}

  async register(email: string, password: string, name?: string) {
    const user = await this.userService.create(email, password, name)
    const tokens = await this.createSession(user.id, 'web')

    return { user, ...tokens }
  }

  async login(
    email: string,
    password: string,
    app: AuthApp,
    meta?: { userAgent?: string; ip?: string },
  ) {
    const user = await this.userService.validatePassword(email, password)

    if (!user.isActive) {
      throw accountDisabledError()
    }

    const roles = await this.authRepository.getRolesForUserByApp(user.id, app)

    // admin 端无角色拒绝登录
    if (app === 'admin' && roles.length === 0) {
      throw noAdminRoleError()
    }

    const tokens = await this.createSession(user.id, app, meta)

    return { user, ...tokens }
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify<JwtRefreshPayload>(refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      })

      if (payload.type !== 'refresh') {
        throw invalidTokenTypeError()
      }

      const jtiHash = this.hashJti(payload.jti)
      const tokenRecord = await this.authRepository.findRefreshTokenByJtiHash(jtiHash)

      if (!tokenRecord) {
        throw tokenNotFoundError()
      }

      // 重放检测：token 已被使用过
      if (tokenRecord.usedAt) {
        await this.authRepository.revokeSession(tokenRecord.sessionId, 'token_replay_detected')
        throw tokenReplayError()
      }

      // token 已撤销
      if (tokenRecord.revokedAt) {
        throw tokenRevokedError()
      }

      // session 已撤销
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

      // 重新加载角色，权限变更即时生效
      const roles = await this.authRepository.getRolesForUserByApp(user.id, payload.app)
      if (payload.app === 'admin' && roles.length === 0) {
        await this.authRepository.revokeSession(tokenRecord.sessionId, 'admin_role_missing')
        throw noAdminRoleError()
      }

      // 标记旧 token 为 used，生成新 token
      const newJti = this.generateJti()
      const newJtiHash = this.hashJti(newJti)
      const newRefreshToken = this.jwtService.sign(
        {
          sub: payload.sub,
          sid: payload.sid,
          app: payload.app,
          jti: newJti,
          type: 'refresh',
        } as JwtRefreshPayload,
        {
          secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
          expiresIn: this.validateExpiresIn(
            this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d',
            'JWT_REFRESH_EXPIRES_IN',
          ),
        },
      )

      await this.authRepository.insertRefreshToken({
        sessionId: payload.sid,
        jtiHash: newJtiHash,
        parentTokenId: tokenRecord.id,
      })

      // 原子标记旧 token 为 used（UPDATE ... WHERE usedAt IS NULL）
      // 只有第一个并发请求能成功，其余返回 false（触发重放检测）
      const marked = await this.authRepository.markRefreshTokenUsed(jtiHash, newJtiHash)
      if (!marked) {
        // 并发竞争失败：另一个请求已经标记了此 token
        // 撤销整条 session 作为安全防御
        await this.authRepository.revokeSession(tokenRecord.sessionId, 'token_replay_detected')
        throw tokenReplayError()
      }

      const accessPayload: JwtAccessPayload = {
        sub: payload.sub,
        sid: payload.sid,
        app: payload.app,
        type: 'access',
      }

      const accessExpiresIn = this.validateExpiresIn(
        this.configService.get<string>('JWT_EXPIRES_IN') || '2h',
        'JWT_EXPIRES_IN',
      )

      const accessToken = this.jwtService.sign(accessPayload, {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
        expiresIn: accessExpiresIn,
      })

      return { accessToken, refreshToken: newRefreshToken, sessionId: payload.sid }
    } catch (err) {
      if (err instanceof AppException) {
        throw err
      }
      const isDev = process.env.NODE_ENV === 'development'
      throw invalidRefreshTokenError(isDev && err instanceof Error ? err.message : undefined)
    }
  }

  async logoutByRefreshToken(refreshToken: string): Promise<void> {
    try {
      const payload = this.jwtService.verify<JwtRefreshPayload>(refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      })

      if (payload.type !== 'refresh') {
        throw invalidTokenTypeError()
      }

      await this.authRepository.revokeSession(payload.sid, 'logout')
      await this.authRedis.invalidateUserCache(payload.sub)
    } catch (err) {
      if (err instanceof AppException) {
        throw err
      }
      throw invalidRefreshTokenError()
    }
  }

  /** 将 access token 加入黑名单 */
  async blacklistToken(token: string): Promise<void> {
    const expiresIn = this.configService.get<string>('JWT_EXPIRES_IN') || '2h'
    const ttlSeconds = this.parseExpiresInToSeconds(expiresIn)
    await this.authRedis.blacklistToken(token, ttlSeconds)
  }

  /** 清除指定用户的 Redis 缓存 */
  async invalidateUserCache(userId: string): Promise<void> {
    await this.authRedis.invalidateUserCache(userId)
  }

  async me(userId: string) {
    const user = await this.userService.findById(userId)
    if (!user) {
      throw userNotFoundError()
    }
    return user
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.userService.updateName(userId, dto.name)
    if (!user) {
      throw userNotFoundError()
    }
    return user
  }

  async uploadAvatar(userId: string, file: { buffer: Buffer; mimetype: string; size: number }) {
    if (!AVATAR_ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: '仅支持 JPEG、PNG、GIF、WebP 格式的图片',
      })
    }

    if (file.size > AVATAR_MAX_SIZE) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: '头像文件大小不能超过 5MB',
      })
    }

    const ext = AVATAR_EXT_MAP[file.mimetype]
    const key = `avatars/${userId}/${Date.now()}.${ext}`

    const currentUser = await this.userService.findById(userId)
    if (!currentUser) {
      throw userNotFoundError()
    }

    await this.storageService.uploadFile(file.buffer, key, file.mimetype)
    const avatarUrl = this.storageService.getUrl(key)

    const user = await this.userService.updateAvatar(userId, avatarUrl)
    if (!user) {
      throw userNotFoundError()
    }

    if (currentUser.avatar) {
      try {
        const oldKey = this.storageService.extractKeyFromUrl(currentUser.avatar)
        if (oldKey) {
          await this.storageService.deleteFile(oldKey)
        }
      } catch (err) {
        this.logger.warn(
          `旧头像删除失败: ${currentUser.avatar} — ${err instanceof Error ? err.message : String(err)}`,
        )
      }
    }

    return { avatarUrl }
  }

  private hashJti(jti: string): string {
    return createHash('sha256').update(jti).digest('hex')
  }

  private generateJti(): string {
    return randomUUID()
  }

  private async createSession(
    userId: string,
    app: AuthApp,
    meta?: { userAgent?: string; ip?: string },
  ): Promise<TokenPair & { sessionId: string }> {
    const session = await this.authRepository.createSession({
      userId,
      app,
      userAgent: meta?.userAgent,
      ip: meta?.ip,
    })

    const jti = this.generateJti()
    const jtiHash = this.hashJti(jti)
    await this.authRepository.insertRefreshToken({
      sessionId: session.id,
      jtiHash,
    })

    const accessPayload: JwtAccessPayload = {
      sub: userId,
      sid: session.id,
      app,
      type: 'access',
    }

    const refreshPayload: JwtRefreshPayload = {
      sub: userId,
      sid: session.id,
      app,
      jti,
      type: 'refresh',
    }

    const accessExpiresIn = this.validateExpiresIn(
      this.configService.get<string>('JWT_EXPIRES_IN') || '2h',
      'JWT_EXPIRES_IN',
    )
    const refreshExpiresIn = this.validateExpiresIn(
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d',
      'JWT_REFRESH_EXPIRES_IN',
    )

    const accessToken = this.jwtService.sign(accessPayload, {
      secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      expiresIn: accessExpiresIn,
    })

    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: refreshExpiresIn,
    })

    return { accessToken, refreshToken, sessionId: session.id }
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
      return configName === 'JWT_EXPIRES_IN' ? '2h' : '7d'
    }
    return value
  }
}
