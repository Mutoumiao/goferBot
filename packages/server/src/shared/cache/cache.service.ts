import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Redis } from 'ioredis'
import { createRedisConnection } from '../../queue/redis.js'

const DEFAULT_TTL_SECONDS = 300
const MAX_SCAN_ITERATIONS = 500

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private redis: Redis | undefined
  private readonly logger = new Logger(CacheService.name)

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const host =
      this.configService.get<string>('CACHE_REDIS_HOST') ??
      this.configService.get<string>('REDIS_HOST', 'localhost')
    const port =
      this.configService.get<number>('CACHE_REDIS_PORT') ??
      this.configService.get<number>('REDIS_PORT', 6379)
    const password =
      this.configService.get<string>('CACHE_REDIS_PASSWORD') ??
      this.configService.get<string>('REDIS_PASSWORD')

    const conn = createRedisConnection(host, port, password)
    this.redis = conn

    try {
      await conn.ping()
      this.logger.log('Cache Redis connection established')
    } catch {
      this.logger.warn(`Cache Redis 连接失败 (${host}:${port})，缓存功能已禁用。`)
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

  async get<T>(key: string): Promise<T | null> {
    if (!this.isEnabled()) return null
    const data = await this.redis?.get(key)
    if (!data) return null
    try {
      return JSON.parse(data) as T
    } catch {
      return null
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number = DEFAULT_TTL_SECONDS): Promise<void> {
    if (!this.isEnabled()) return
    const serialized = typeof value === 'string' ? value : JSON.stringify(value)
    await this.redis?.setex(key, ttlSeconds, serialized)
  }

  async del(key: string): Promise<void> {
    if (!this.isEnabled()) return
    await this.redis?.del(key)
  }

  async delByPrefix(prefix: string): Promise<void> {
    if (!this.isEnabled()) return
    const fullPrefix = prefix.endsWith(':') ? prefix : `${prefix}:`
    let cursor = '0'
    let iterations = 0
    let totalDeleted = 0
    do {
      if (iterations >= MAX_SCAN_ITERATIONS) {
        this.logger.warn(
          `delByPrefix exceeded ${MAX_SCAN_ITERATIONS} iterations for prefix ${prefix}, stopped early. Deleted ${totalDeleted} keys.`,
        )
        break
      }
      iterations++
      const result = await this.redis?.scan(cursor, 'MATCH', `${fullPrefix}*`, 'COUNT', '100')
      if (!result) break
      cursor = result[0]
      const keys = result[1]
      if (keys.length > 0) {
        await this.redis?.del(...keys)
        totalDeleted += keys.length
      }
    } while (cursor !== '0')
  }

  async getOrSet<T>(
    key: string,
    loader: () => Promise<T>,
    ttlSeconds: number = DEFAULT_TTL_SECONDS,
  ): Promise<T> {
    const cached = await this.get<T>(key)
    if (cached !== null) return cached
    const value = await loader()
    await this.set(key, value, ttlSeconds)
    return value
  }
}
