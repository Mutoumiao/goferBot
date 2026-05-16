import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { UserService } from '../modules/user/user.service.js'

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
  ) {}

  async register(email: string, password: string, name?: string) {
    const user = await this.userService.create(email, password, name)
    const tokens = await this.generateTokens(user.id, user.email)

    return { user, ...tokens }
  }

  async login(email: string, password: string) {
    const user = await this.userService.validatePassword(email, password)
    const tokens = await this.generateTokens(user.id, user.email)

    return { user, ...tokens }
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify<JwtRefreshPayload>(refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
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
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN') || '15m',
    })

    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d',
    })

    return { accessToken, refreshToken }
  }
}
