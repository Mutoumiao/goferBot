import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Redis } from 'ioredis'
import { createRedisConnection } from '../queue/redis.js'

const TOKEN_BLACKLIST_PREFIX = 'token:blacklist:'
const USER_CACHE_PREFIX = 'auth:user:'
const USER_CACHE_TTL_SECONDS = 300 // 5 分钟
const PERMISSION_CACHE_PREFIX = 'auth:permission:'
const PERMISSION_CACHE_TTL_SECONDS = 300 // 5 分钟

/**
 * Auth 模块专用 Redis 服务。
 * 负责 JWT 令牌黑名单与用户缓存，与队列 Redis 独立连接以避免相互影响。
 */
@Injectable()
export class AuthRedisService implements OnModuleInit, OnModuleDestroy {
  private redis: Redis | undefined
  private ready = false
  private readonly logger = new Logger(AuthRedisService.name)

  constructor(private readonly configService: ConfigService) {
    this.isProduction = configService.get('NODE_ENV') === 'production'
  }

  private readonly isProduction: boolean

  async onModuleInit() {
    const host = this.configService.get<string>('REDIS_HOST', 'localhost')
    const port = this.configService.get<number>('REDIS_PORT', 6379)
    const password = this.configService.get<string>('REDIS_PASSWORD')

    const conn = createRedisConnection(host, port, password)
    this.redis = conn

    try {
      await conn.ping()
      this.ready = true
      this.logger.log('Auth Redis connection established')
    } catch {
      this.logger.warn(`Auth Redis 连接失败 (${host}:${port})，令牌黑名单与用户缓存已禁用。`)
      await conn.quit().catch(() => {})
      this.redis = undefined
      this.ready = false
      if (this.isProduction) {
        // 生产环境 Redis 不可用时 fail-closed：拒绝令牌黑名单查询，阻止所有需要黑名单保护的端点
        this.logger.error('PRODUCTION: Redis 不可用，将以 fail-closed 模式拒绝认证请求。')
      }
    }
  }

  onModuleDestroy() {
    this.redis?.quit().catch(() => {})
  }

  private isReady(): boolean {
    return this.ready && this.redis !== undefined && this.redis.status === 'ready'
  }

  /** 是否 fail-closed：生产环境且 Redis 未就绪时，关键安全操作必须拒绝而非降级 */
  get isFailClosed(): boolean {
    return this.isProduction && !this.isReady()
  }

  /** 将 access token 加入黑名单，过期时间与 token 剩余有效期一致 */
  async blacklistToken(token: string, ttlSeconds: number): Promise<void> {
    if (!this.isReady()) return
    await this.redis?.setex(`${TOKEN_BLACKLIST_PREFIX}${token}`, ttlSeconds, '1')
  }

  /**
   * 检查 token 是否在黑名单中
   * 生产环境 Redis 不可用时视为"在黑名单"，返回 true 以 fail-closed
   */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    if (!this.isReady()) {
      if (this.isProduction) {
        this.logger.warn('PRODUCTION: Redis 不可用，黑名单检查 fail-closed，拒绝 token。')
        return true
      }
      return false
    }
    const result = await this.redis?.get(`${TOKEN_BLACKLIST_PREFIX}${token}`)
    return result !== null
  }

  /** 写入字符串键（带 TTL 秒），用于验证码等一次性令牌 */
  async setex(key: string, ttlSeconds: number, value: string): Promise<void> {
    if (!this.isReady()) return
    await this.redis?.setex(key, ttlSeconds, value)
  }

  /** 读取字符串键；不存在返回 null */
  async get(key: string): Promise<string | null> {
    if (!this.isReady()) return null
    return (await this.redis?.get(key)) ?? null
  }

  /** 删除字符串键 */
  async del(key: string): Promise<void> {
    if (!this.isReady()) return
    await this.redis?.del(key)
  }

  /** 缓存用户信息 */
  async cacheUser(userId: string, user: Record<string, unknown>): Promise<void> {
    if (!this.isReady()) return
    await this.redis?.setex(
      `${USER_CACHE_PREFIX}${userId}`,
      USER_CACHE_TTL_SECONDS,
      JSON.stringify(user),
    )
  }

  /** 获取缓存的用户信息 */
  async getCachedUser(userId: string): Promise<Record<string, unknown> | null> {
    if (!this.isReady()) return null
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
    if (!this.isReady()) return
    await this.redis?.del(`${USER_CACHE_PREFIX}${userId}`)
  }

  /**
   * 是否允许更新 lastSeen（基于 Redis SETNX 实现简单节流）
   * @param key 节流键（如 sessionId 或 userId）
   * @param intervalSeconds 节流间隔（秒），默认 60
   * @returns true 表示允许更新，false 表示被节流
   */
  async shouldUpdateLastSeen(key: string, intervalSeconds = 60): Promise<boolean> {
    if (!this.isReady()) return true
    const throttleKey = `auth:lastSeen:throttle:${key}`
    const result = await this.redis?.set(throttleKey, '1', 'EX', intervalSeconds, 'NX')
    return result === 'OK'
  }

  /** 缓存用户权限 */
  async cacheUserPermissions(userId: string, permissions: string[]): Promise<void> {
    if (!this.isReady()) return
    await this.redis?.setex(
      `${PERMISSION_CACHE_PREFIX}${userId}`,
      PERMISSION_CACHE_TTL_SECONDS,
      JSON.stringify(permissions),
    )
  }

  /** 获取缓存的用户权限 */
  async getCachedUserPermissions(userId: string): Promise<string[] | null> {
    if (!this.isReady()) return null
    const data = await this.redis?.get(`${PERMISSION_CACHE_PREFIX}${userId}`)
    if (!data) return null
    try {
      return JSON.parse(data) as string[]
    } catch {
      return null
    }
  }

  /** 清除用户权限缓存（权限变更时） */
  async invalidateUserPermissions(userId: string): Promise<void> {
    if (!this.isReady()) return
    await this.redis?.del(`${PERMISSION_CACHE_PREFIX}${userId}`)
  }

  /** 批量清除用户权限缓存（角色权限变更时） */
  async invalidateAllUserPermissions(): Promise<void> {
    if (!this.isReady()) return
    const keys = await this.redis?.keys(`${PERMISSION_CACHE_PREFIX}*`)
    if (keys && keys.length > 0) {
      await this.redis?.del(keys)
    }
  }

  /** 健康检查：PING Redis；未就绪时返回 'skipped' 表示降级而非故障 */
  async ping(): Promise<string> {
    if (!this.isReady()) return 'skipped'
    return (await this.redis?.ping()) ?? 'skipped'
  }
}
