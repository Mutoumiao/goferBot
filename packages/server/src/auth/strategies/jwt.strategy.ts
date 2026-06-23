import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { PrismaService } from '../../processors/database/prisma.service.js'
import { AuthRedisService } from '../auth-redis.service.js'
import { Role } from '../enums/role.enum.js'

export interface JwtPayload {
  sub: string
  email: string
  type: 'access' | 'refresh'
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    @Inject(ConfigService) readonly configService: ConfigService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuthRedisService) private readonly authRedis: AuthRedisService,
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

    // 1. 尝试从 Redis 缓存获取用户信息
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
        role: cached.role as Role,
        isActive: cached.isActive as boolean,
        createdAt: cached.createdAt as Date,
        updatedAt: cached.updatedAt as Date,
      }
    }

    // 2. 缓存未命中，查询数据库并写入缓存
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
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

    await this.authRedis.cacheUser(user.id, user as unknown as Record<string, unknown>)

    return {
      ...user,
      role: user.role as Role,
    }
  }
}
