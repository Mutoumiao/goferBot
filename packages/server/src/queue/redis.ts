import { Redis } from 'ioredis'
import type { Redis as RedisType } from 'ioredis'

export function createRedisConnection(
  host: string,
  port: number,
  password?: string,
): RedisType {
  const redis = new Redis({
    host,
    port,
    password: password || undefined,
    family: 4,
    maxRetriesPerRequest: 3,
    enableReadyCheck: false,
    retryStrategy(times) {
      const delay = Math.min(times * 2000, 10000)
      if (times > 5) {
        console.error(`[Redis] 重连 ${times} 次后放弃，请检查 Redis 服务是否运行`)
        return null
      }
      return delay
    },
  })

  redis.on('error', (err: Error) => {
    if (!err.message.includes('ECONNREFUSED')) {
      console.error('Redis connection error:', err.message)
    }
  })

  return redis
}
