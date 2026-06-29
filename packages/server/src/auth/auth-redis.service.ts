import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Redis } from 'ioredis'
import { createRedisConnection } from '../queue/redis.js'

const TOKEN_BLACKLIST_PREFIX = 'token:blacklist:'
const USER_CACHE_PREFIX = 'auth:user:'
const USER_CACHE_TTL_SECONDS = 300 // 5 分钟

/**
 * Auth 模块专用 Redis 服务。
 * 负责 JWT 令牌黑名单与用户缓存，与队列 Redis 独立连接以避免相互影响。
 */
@Injectable()
export class AuthRedisService implements OnModuleInit, OnModuleDestroy {
  private redis: Redis | undefined
  private readonly logger = new Logger(AuthRedisService.name)

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const host = this.configService.get<string>('REDIS_HOST', 'localhost')
    const port = this.configService.get<number>('REDIS_PORT', 6379)
    const password = this.configService.get<string>('REDIS_PASSWORD')

    const conn = createRedisConnection(host, port, password)
    this.redis = conn

    try {
      await conn.ping()
      this.logger.log('Auth Redis connection established')
    } catch {
      this.logger.warn(`Auth Redis 连接失败 (${host}:${port})，令牌黑名单与用户缓存已禁用。`)
      await conn.quit().catch(() => {})
      this.redis = undefined
    }
  }

  onModuleDestroy() {
    this.redis?.quit().catch(() => {})
  }

  private isEnabled(): boolean {
    return this.redis !== undefined && this.redis.status === 'ready'
  }

  /** 将 access token 加入黑名单，过期时间与 token 剩余有效期一致 */
  async blacklistToken(token: string, ttlSeconds: number): Promise<void> {
    if (!this.isEnabled()) return
    await this.redis?.setex(`${TOKEN_BLACKLIST_PREFIX}${token}`, ttlSeconds, '1')
  }

  /** 检查 token 是否在黑名单中 */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    if (!this.isEnabled()) return false
    const result = await this.redis?.get(`${TOKEN_BLACKLIST_PREFIX}${token}`)
    return result !== null
  }

  /** 缓存用户信息 */
  async cacheUser(userId: string, user: Record<string, unknown>): Promise<void> {
    if (!this.isEnabled()) return
    await this.redis?.setex(
      `${USER_CACHE_PREFIX}${userId}`,
      USER_CACHE_TTL_SECONDS,
      JSON.stringify(user),
    )
  }

  /** 获取缓存的用户信息 */
  async getCachedUser(userId: string): Promise<Record<string, unknown> | null> {
    if (!this.isEnabled()) return null
    const data = await this.redis?.get(`${USER_CACHE_PREFIX}${userId}`)
    if (!data) return null
    try {
      return JSON.parse(data) as Record<string, unknown>
    } catch {
      return null
    }
  }

  /** 清除用户缓存（如账号状态变更时） */
  async invalidateUserCache(userId: string): Promise<void> {
    if (!this.isEnabled()) return
    await this.redis?.del(`${USER_CACHE_PREFIX}${userId}`)
  }

  /** 健康检查：PING Redis；未启用时返回 'skipped' 表示降级而非故障 */
  async ping(): Promise<string> {
    if (!this.isEnabled()) return 'skipped'
    return await this.redis!.ping()
  }
}
