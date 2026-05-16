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
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  })

  redis.on('error', (err: Error) => {
    console.error('Redis connection error:', err.message)
  })

  return redis
}
