import { Injectable, UnauthorizedException, ForbiddenException, BadRequestException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { UserService } from '../modules/user/user.service.js'
import { StorageService } from '../processors/storage/storage.service.js'
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
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly userService: UserService,
    private readonly storageService: StorageService,
  ) {}

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
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: '刷新令牌无效或已过期',
      })
    }
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
        const oldKey = this.extractKeyFromUrl(currentUser.avatar)
        if (oldKey) {
          await this.storageService.deleteFile(oldKey)
        }
      } catch {
        // 旧头像删除失败不影响新头像更新结果
      }
    }

    return { avatarUrl }
  }

  private extractKeyFromUrl(url: string): string | null {
    try {
      const parsed = new URL(url)
      // MinIO URL 格式：{endpoint}/{bucket}/{key}
      const parts = parsed.pathname.split('/').filter(Boolean)
      if (parts.length >= 2) {
        return parts.slice(1).join('/')
      }
      return null
    } catch {
      return null
    }
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

    const accessToken = this.jwtService.sign(accessPayload, {
      secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN') || '2h',
    })

    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d',
    })

    return { accessToken, refreshToken }
  }
}
