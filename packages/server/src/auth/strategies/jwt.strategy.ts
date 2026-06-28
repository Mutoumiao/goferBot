import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { PrismaService } from '../../processors/database/prisma.service.js'
import { AuthRedisService } from '../auth-redis.service.js'
import { AuthRepository } from '../repositories/auth.repository.js'
import type { AuthApp } from '../types/auth-app.type.js'

export interface JwtPayload {
  sub: string
  email?: string
  sid: string
  app: AuthApp
  type: 'access' | 'refresh'
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    @Inject(ConfigService) readonly configService: ConfigService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuthRedisService) private readonly authRedis: AuthRedisService,
    @Inject(AuthRepository) private readonly authRepository: AuthRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    })
  }

  async validate(payload: JwtPayload) {
    if (payload.type !== 'access') {
      throw new UnauthorizedException('无效的令牌类型')
    }

    if (!payload.sid || !payload.app) {
      throw new UnauthorizedException('无效的令牌声明')
    }

    const session = await this.prisma.authSession.findUnique({
      where: { id: payload.sid },
    })

    if (!session || session.revokedAt) {
      throw new UnauthorizedException('会话已失效')
    }

    const cached = await this.authRedis.getCachedUser(payload.sub)
    if (cached) {
      if (!cached.isActive) {
        throw new UnauthorizedException('账号已被禁用')
      }
      return {
        id: cached.id as string,
        email: cached.email as string,
        name: cached.name as string | null,
        avatar: cached.avatar as string | null,
        roles: cached.roles as string[],
        isActive: cached.isActive as boolean,
        createdAt: cached.createdAt as Date,
        updatedAt: cached.updatedAt as Date,
        sessionId: payload.sid,
        app: payload.app,
      }
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!user) {
      throw new UnauthorizedException('用户不存在')
    }

    if (!user.isActive) {
      throw new UnauthorizedException('账号已被禁用')
    }

    // 从 UserRole 表按应用拉取角色
    const userRoles = await this.authRepository.getRolesForUserByApp(user.id, payload.app)
    const roles = userRoles.map((r) => r.role)

    await this.authRedis.cacheUser(user.id, { ...user, roles } as unknown as Record<
      string,
      unknown
    >)
    await this.authRepository.updateLastSeen(payload.sid)

    return {
      ...user,
      roles,
      sessionId: payload.sid,
      app: payload.app,
    }
  }
}
