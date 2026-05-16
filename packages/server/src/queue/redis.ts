import { Redis } from 'ioredis'

export const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
  maxRetriesPerRequest: null, // BullMQ 要求必须设为 null
})

export async function checkRedisConnection(): Promise<void> {
  try {
    await redis.ping()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Redis connection failed: ${message}`)
  }
}
