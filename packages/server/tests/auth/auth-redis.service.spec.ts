import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthRedisService } from '@/auth/auth-redis.service.js'

// ponytail: 使用 mock Redis 替代真实连接，避免测试依赖外部服务
const createMockRedis = (overrides?: Partial<MockRedis>) => {
  const mock = {
    status: 'ready',
    ping: vi.fn().mockResolvedValue('PONG'),
    setex: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockResolvedValue(null),
    del: vi.fn().mockResolvedValue(1),
    quit: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
  return mock
}

interface MockRedis {
  status: string
  ping: ReturnType<typeof vi.fn>
  setex: ReturnType<typeof vi.fn>
  get: ReturnType<typeof vi.fn>
  del: ReturnType<typeof vi.fn>
  quit: ReturnType<typeof vi.fn>
}

describe('AuthRedisService', () => {
  let service: AuthRedisService
  let mockRedis: MockRedis
  let mockConfigService: any

  beforeEach(() => {
    mockConfigService = {
      get: vi.fn((key: string, defaultValue?: any) => defaultValue),
    }
    service = new AuthRedisService(mockConfigService)
  })

  // 通过反射注入 mock Redis，避免 onModuleInit 的真实连接
  // ponytail: 同时注入 ready=true 使 isReady() 通过（构造函数默认 ready=false）
  const injectRedis = (redis: MockRedis) => {
    ;(service as any).redis = redis
    ;(service as any).ready = true
  }

  describe('blacklistToken', () => {
    it('AR-01a: 将 token 写入 Redis 黑名单，TTL 正确', async () => {
      mockRedis = createMockRedis()
      injectRedis(mockRedis)

      await service.blacklistToken('token-abc', 7200)

      expect(mockRedis.setex).toHaveBeenCalledWith('token:blacklist:token-abc', 7200, '1')
    })

    it('AR-01b: Redis 未连接时静默跳过', async () => {
      mockRedis = createMockRedis({ status: 'end' })
      injectRedis(mockRedis)

      await service.blacklistToken('token-abc', 7200)

      expect(mockRedis.setex).not.toHaveBeenCalled()
    })
  })

  describe('isTokenBlacklisted', () => {
    it('AR-02a: 黑名单中的 token 返回 true', async () => {
      mockRedis = createMockRedis({ get: vi.fn().mockResolvedValue('1') })
      injectRedis(mockRedis)

      const result = await service.isTokenBlacklisted('token-abc')

      expect(result).toBe(true)
      expect(mockRedis.get).toHaveBeenCalledWith('token:blacklist:token-abc')
    })

    it('AR-02b: 未黑名单的 token 返回 false', async () => {
      mockRedis = createMockRedis({ get: vi.fn().mockResolvedValue(null) })
      injectRedis(mockRedis)

      const result = await service.isTokenBlacklisted('token-abc')

      expect(result).toBe(false)
    })

    it('AR-02c: Redis 未连接时返回 false（安全默认：未命中）', async () => {
      mockRedis = createMockRedis({ status: 'end' })
      injectRedis(mockRedis)

      const result = await service.isTokenBlacklisted('token-abc')

      expect(result).toBe(false)
      expect(mockRedis.get).not.toHaveBeenCalled()
    })
  })

  describe('cacheUser / getCachedUser', () => {
    it('AR-03a: 缓存用户信息并正确读取', async () => {
      const user = { id: 'u1', email: 'test@gofer.bot', isActive: true }
      mockRedis = createMockRedis({
        get: vi.fn().mockResolvedValue(JSON.stringify(user)),
      })
      injectRedis(mockRedis)

      await service.cacheUser('u1', user)
      const cached = await service.getCachedUser('u1')

      expect(mockRedis.setex).toHaveBeenCalledWith('auth:user:u1', 300, JSON.stringify(user))
      expect(cached).toEqual(user)
    })

    it('AR-03b: 缓存未命中返回 null', async () => {
      mockRedis = createMockRedis()
      injectRedis(mockRedis)

      const cached = await service.getCachedUser('u1')

      expect(cached).toBeNull()
    })

    it('AR-03c: 缓存数据损坏返回 null（不抛异常）', async () => {
      mockRedis = createMockRedis({ get: vi.fn().mockResolvedValue('invalid-json') })
      injectRedis(mockRedis)

      const cached = await service.getCachedUser('u1')

      expect(cached).toBeNull()
    })
  })

  describe('invalidateUserCache', () => {
    it('AR-04a: 清除指定用户缓存', async () => {
      mockRedis = createMockRedis()
      injectRedis(mockRedis)

      await service.invalidateUserCache('u1')

      expect(mockRedis.del).toHaveBeenCalledWith('auth:user:u1')
    })

    it('AR-04b: Redis 未连接时静默跳过', async () => {
      mockRedis = createMockRedis({ status: 'end' })
      injectRedis(mockRedis)

      await service.invalidateUserCache('u1')

      expect(mockRedis.del).not.toHaveBeenCalled()
    })
  })
})
