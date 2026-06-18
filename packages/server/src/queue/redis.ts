import type { Redis as RedisType } from 'ioredis'
import { Redis } from 'ioredis'

export function createRedisConnection(host: string, port: number, password?: string): RedisType {
  return new Redis({
    host,
    port,
    password: password || undefined,
    family: 4,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  })
}
