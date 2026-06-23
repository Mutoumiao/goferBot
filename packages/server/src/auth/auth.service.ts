import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { UserService } from '../modules/user/user.service.js'
import { StorageService } from '../processors/storage/storage.service.js'
import { AuthRedisService } from './auth-redis.service.js'
import { UpdateProfileDto } from './dto/update-profile.dto.js'

export interface TokenPair {
  accessToken: string
  refreshToken: string
}

export interface JwtAccessPayload {
  sub: string
  email: string
  type: 'access'
}

export interface JwtRefreshPayload {
  sub: string
  email: string
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
  ) { }

  async register(email: string, password: string, name?: string) {
    const user = await this.userService.create(email, password, name)
    const tokens = await this.generateTokens(user.id, user.email)

    return { user, ...tokens }
  }

  async login(email: string, password: string) {
    const user = await this.userService.validatePassword(email, password)

    if (!user.isActive) {
      throw new ForbiddenException({
        code: 'ACCOUNT_DISABLED',
        message: '账号已被禁用',
      })
    }

    const tokens = await this.generateTokens(user.id, user.email)

    return { user, ...tokens }
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify<JwtRefreshPayload>(refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      })

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException({
          code: 'INVALID_TOKEN_TYPE',
          message: '无效的刷新令牌',
        })
      }

      const user = await this.userService.findById(payload.sub)
      if (!user) {
        throw new UnauthorizedException({
          code: 'USER_NOT_FOUND',
          message: '用户不存在',
        })
      }

      if (!user.isActive) {
        throw new ForbiddenException({
          code: 'ACCOUNT_DISABLED',
          message: '账号已被禁用',
        })
      }

      return this.generateTokens(user.id, user.email)
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        throw err
      }
      // 开发环境保留原始错误信息用于调试
      const isDev = process.env.NODE_ENV === 'development'
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: '刷新令牌无效或已过期',
        details: isDev && err instanceof Error ? err.message : undefined,
      })
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

  private parseExpiresInToSeconds(expiresIn: string): number {
    const match = expiresIn.match(/^(\d+)([smhd])$/)
    if (!match) return 7200 // 默认 2h
    const value = parseInt(match[1], 10)
    const unit = match[2]
    const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 }
    return value * (multipliers[unit] || 3600)
  }

  async me(userId: string) {
    const user = await this.userService.findById(userId)
    if (!user) {
      throw new UnauthorizedException({
        code: 'USER_NOT_FOUND',
        message: '用户不存在',
      })
    }
    return user
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.userService.updateName(userId, dto.name)
    if (!user) {
      throw new UnauthorizedException({
        code: 'USER_NOT_FOUND',
        message: '用户不存在',
      })
    }
    return user
  }

  async uploadAvatar(userId: string, file: { buffer: Buffer; mimetype: string; size: number }) {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    const extMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
    }

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: '仅支持 JPEG、PNG、GIF、WebP 格式的图片',
      })
    }

    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: '头像文件大小不能超过 5MB',
      })
    }

    const ext = extMap[file.mimetype]
    const key = `avatars/${userId}/${Date.now()}.${ext}`

    const currentUser = await this.userService.findById(userId)
    if (!currentUser) {
      throw new UnauthorizedException({
        code: 'USER_NOT_FOUND',
        message: '用户不存在',
      })
    }

    await this.storageService.uploadFile(file.buffer, key, file.mimetype)
    const avatarUrl = this.storageService.getUrl(key)

    const user = await this.userService.updateAvatar(userId, avatarUrl)
    if (!user) {
      throw new UnauthorizedException({
        code: 'USER_NOT_FOUND',
        message: '用户不存在',
      })
    }

    // 上传新头像成功后，删除旧头像文件
    if (currentUser.avatar) {
      try {
        const oldKey = this.storageService.extractKeyFromUrl(currentUser.avatar)
        if (oldKey) {
          await this.storageService.deleteFile(oldKey)
        }
      } catch (err) {
        // 旧头像删除失败不影响新头像更新结果，但记录日志以便排查
        this.logger.warn(`旧头像删除失败: ${currentUser.avatar} — ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    return { avatarUrl }
  }

  private async generateTokens(userId: string, email: string): Promise<TokenPair> {
    const accessPayload: JwtAccessPayload = {
      sub: userId,
      email,
      type: 'access',
    }

    const refreshPayload: JwtRefreshPayload = {
      sub: userId,
      email,
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

    return { accessToken, refreshToken }
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
