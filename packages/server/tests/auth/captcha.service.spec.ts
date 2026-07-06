import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CaptchaService } from '@/auth/captcha.service.js'

const CAPTCHA_PREFIX = 'captcha:'
const CAPTCHA_TTL_SECONDS = 120

const createMockRedis = (overrides?: Partial<MockRedis>) => ({
  status: 'ready',
  setex: vi.fn().mockResolvedValue('OK'),
  get: vi.fn().mockResolvedValue(null),
  del: vi.fn().mockResolvedValue(1),
  ...overrides,
})

interface MockRedis {
  status: string
  setex: ReturnType<typeof vi.fn>
  get: ReturnType<typeof vi.fn>
  del: ReturnType<typeof vi.fn>
}

const createMockConfigService = (captchaEnabled?: boolean, whitelistOrigins?: string, nodeEnv?: string) => ({
  get: vi.fn((key: string) => {
    if (key === 'CAPTCHA_ENABLED') {
      return captchaEnabled
    }
    if (key === 'CAPTCHA_WHITELIST_ORIGINS') {
      return whitelistOrigins
    }
    if (key === 'NODE_ENV') {
      return nodeEnv ?? 'development'
    }
    return undefined
  }),
})

describe('CaptchaService', () => {
  let service: CaptchaService
  let mockRedis: MockRedis
  let mockAuthRedis: any
  let mockConfigService: any

  beforeEach(() => {
    mockRedis = createMockRedis()
    mockAuthRedis = {
      setex: vi.fn(async (key: string, ttl: number, value: string) => {
        mockRedis.setex(key, ttl, value)
      }),
      get: vi.fn(async (key: string) => {
        const v = await mockRedis.get(key)
        return v
      }),
      del: vi.fn(async (key: string) => {
        mockRedis.del(key)
      }),
    }
    mockConfigService = createMockConfigService()
    service = new CaptchaService(mockAuthRedis, mockConfigService)
  })

  describe('generateChallenge', () => {
    it('CS-01a: 生成唯一 captchaId、PNG buffer 并把验证码存入 Redis', async () => {
      const result = await service.generateChallenge()

      expect(result.captchaId).toBeTruthy()
      expect(result.imagePng).toBeInstanceOf(Buffer)
      expect(result.imagePng.length).toBeGreaterThan(100)
      expect(result.expiresInSeconds).toBe(CAPTCHA_TTL_SECONDS)

      // 两次 setex：分别存验证码明文与图片 base64
      expect(mockAuthRedis.setex).toHaveBeenCalledTimes(2)
      const [[codeKey, codeTtl, code], [imgKey, imgTtl, img]] = mockAuthRedis.setex.mock.calls as [
        string,
        number,
        string,
      ][]
      expect(codeKey.startsWith(CAPTCHA_PREFIX)).toBe(true)
      expect(imgKey.startsWith('captcha:img:')).toBe(true)
      expect(codeTtl).toBe(CAPTCHA_TTL_SECONDS)
      expect(imgTtl).toBe(CAPTCHA_TTL_SECONDS)
      expect(typeof code).toBe('string')
      expect(code.length).toBe(4)
      expect(typeof img).toBe('string')
      expect(img.length).toBeGreaterThan(100)
    })

    it('CS-01b: 每次生成的 captchaId 均不相同', async () => {
      const a = await service.generateChallenge()
      const b = await service.generateChallenge()
      expect(a.captchaId).not.toBe(b.captchaId)
    })

    it('CS-01c: PNG buffer 以 PNG 签名开头', async () => {
      const { imagePng } = await service.generateChallenge()
      // PNG 魔数: 89 50 4E 47
      expect(imagePng[0]).toBe(0x89)
      expect(imagePng[1]).toBe(0x50)
      expect(imagePng[2]).toBe(0x4e)
      expect(imagePng[3]).toBe(0x47)
    })
  })

  describe('getImageData', () => {
    it('CS-02a: 返回 captchaId、base64 与 imageUrl，且 base64 非空', async () => {
      const data = await service.getImageData()
      expect(data.captchaId).toBeTruthy()
      expect(typeof data.imageBase64).toBe('string')
      expect(data.imageBase64.length).toBeGreaterThan(100)
      expect(data.imageUrl).toContain(data.captchaId)
      expect(data.expiresIn).toBe(CAPTCHA_TTL_SECONDS)
    })
  })

  describe('verify', () => {
    it('CS-03a: 验证码匹配时返回 true 并立即删除', async () => {
      mockRedis = createMockRedis({
        get: vi.fn().mockResolvedValue('ABCD'),
      })
      mockAuthRedis = {
        setex: vi.fn(async () => { }),
        get: vi.fn(async (key: string) => mockRedis.get(key)),
        del: vi.fn(async (key: string) => {
          mockRedis.del(key)
        }),
      }
      service = new CaptchaService(mockAuthRedis, mockConfigService)

      const ok = await service.verify('cid-1', 'abcd')
      expect(ok).toBe(true)
      expect(mockAuthRedis.get).toHaveBeenCalledWith(`${CAPTCHA_PREFIX}cid-1`)
      expect(mockAuthRedis.del).toHaveBeenCalledWith(`${CAPTCHA_PREFIX}cid-1`)
      expect(mockAuthRedis.del).toHaveBeenCalledWith('captcha:img:cid-1')
    })

    it('CS-03b: 验证码不匹配时返回 false 并立即删除（防重放）', async () => {
      mockRedis = createMockRedis({
        get: vi.fn().mockResolvedValue('ABCD'),
      })
      mockAuthRedis = {
        setex: vi.fn(async () => { }),
        get: vi.fn(async (key: string) => mockRedis.get(key)),
        del: vi.fn(async (key: string) => {
          mockRedis.del(key)
        }),
      }
      service = new CaptchaService(mockAuthRedis, mockConfigService)

      const ok = await service.verify('cid-1', 'wrong')
      expect(ok).toBe(false)
      expect(mockAuthRedis.del).toHaveBeenCalledWith(`${CAPTCHA_PREFIX}cid-1`)
      expect(mockAuthRedis.del).toHaveBeenCalledWith('captcha:img:cid-1')
    })

    it('CS-03c: 已过期（Redis 未命中）返回 false', async () => {
      mockRedis = createMockRedis({
        get: vi.fn().mockResolvedValue(null),
      })
      mockAuthRedis = {
        setex: vi.fn(async () => { }),
        get: vi.fn(async (key: string) => mockRedis.get(key)),
        del: vi.fn(async () => { }),
      }
      service = new CaptchaService(mockAuthRedis, mockConfigService)

      const ok = await service.verify('cid-1', 'ABCD')
      expect(ok).toBe(false)
    })

    it('CS-03d: captchaId 或 code 为空直接返回 false', async () => {
      expect(await service.verify('', 'ABCD')).toBe(false)
      expect(await service.verify('cid-1', '')).toBe(false)
      expect(await service.verify('', '')).toBe(false)
    })
  })

  describe('verifyWithOrigin', () => {
    it('CS-06a: 验证码未启用时直接跳过验证返回 true', async () => {
      mockConfigService = createMockConfigService(false)
      service = new CaptchaService(mockAuthRedis, mockConfigService)

      const ok = await service.verifyWithOrigin('http://localhost:1421', '', '')
      expect(ok).toBe(true)
    })

    it('CS-06b: 验证码启用且 Origin 在白名单中时直接跳过验证返回 true', async () => {
      mockConfigService = createMockConfigService(true, 'http://localhost:1421,http://localhost:3000')
      service = new CaptchaService(mockAuthRedis, mockConfigService)

      const ok = await service.verifyWithOrigin('http://localhost:1421', '', '')
      expect(ok).toBe(true)
    })

    it('CS-06c: 验证码启用且 Origin 不在白名单中时执行正常验证码校验', async () => {
      mockConfigService = createMockConfigService(true, 'http://localhost:3000')
      mockRedis = createMockRedis({
        get: vi.fn().mockResolvedValue('ABCD'),
      })
      mockAuthRedis = {
        setex: vi.fn(async () => { }),
        get: vi.fn(async (key: string) => mockRedis.get(key)),
        del: vi.fn(async (key: string) => {
          mockRedis.del(key)
        }),
      }
      service = new CaptchaService(mockAuthRedis, mockConfigService)

      const ok = await service.verifyWithOrigin('http://localhost:1421', 'cid-1', 'abcd')
      expect(ok).toBe(true)
      expect(mockAuthRedis.get).toHaveBeenCalledWith(`${CAPTCHA_PREFIX}cid-1`)
    })

    it('CS-06d: 验证码启用且 Origin 不在白名单中且验证码错误时返回 false', async () => {
      mockConfigService = createMockConfigService(true, 'http://localhost:3000')
      mockRedis = createMockRedis({
        get: vi.fn().mockResolvedValue('ABCD'),
      })
      mockAuthRedis = {
        setex: vi.fn(async () => { }),
        get: vi.fn(async (key: string) => mockRedis.get(key)),
        del: vi.fn(async (key: string) => {
          mockRedis.del(key)
        }),
      }
      service = new CaptchaService(mockAuthRedis, mockConfigService)

      const ok = await service.verifyWithOrigin('http://localhost:1421', 'cid-1', 'wrong')
      expect(ok).toBe(false)
    })

    it('CS-06e: 验证码启用且未配置白名单时执行正常验证码校验', async () => {
      mockConfigService = createMockConfigService(true)
      mockRedis = createMockRedis({
        get: vi.fn().mockResolvedValue('ABCD'),
      })
      mockAuthRedis = {
        setex: vi.fn(async () => { }),
        get: vi.fn(async (key: string) => mockRedis.get(key)),
        del: vi.fn(async (key: string) => {
          mockRedis.del(key)
        }),
      }
      service = new CaptchaService(mockAuthRedis, mockConfigService)

      const ok = await service.verifyWithOrigin('http://localhost:1421', 'cid-1', 'abcd')
      expect(ok).toBe(true)
    })

    it('CS-06f: 验证码启用且 Origin 为空时执行正常验证码校验', async () => {
      mockConfigService = createMockConfigService(true, 'http://localhost:3000')
      mockRedis = createMockRedis({
        get: vi.fn().mockResolvedValue('ABCD'),
      })
      mockAuthRedis = {
        setex: vi.fn(async () => { }),
        get: vi.fn(async (key: string) => mockRedis.get(key)),
        del: vi.fn(async (key: string) => {
          mockRedis.del(key)
        }),
      }
      service = new CaptchaService(mockAuthRedis, mockConfigService)

      const ok = await service.verifyWithOrigin(undefined, 'cid-1', 'abcd')
      expect(ok).toBe(true)
    })

    it('CS-06g: 生产环境中白名单配置被忽略，执行正常验证码校验', async () => {
      mockConfigService = createMockConfigService(true, 'http://localhost:1421', 'production')
      mockRedis = createMockRedis({
        get: vi.fn().mockResolvedValue('ABCD'),
      })
      mockAuthRedis = {
        setex: vi.fn(async () => { }),
        get: vi.fn(async (key: string) => mockRedis.get(key)),
        del: vi.fn(async (key: string) => {
          mockRedis.del(key)
        }),
      }
      service = new CaptchaService(mockAuthRedis, mockConfigService)

      const ok = await service.verifyWithOrigin('http://localhost:1421', 'cid-1', 'abcd')
      expect(ok).toBe(true)
      expect(mockAuthRedis.get).toHaveBeenCalledWith(`${CAPTCHA_PREFIX}cid-1`)
    })

    it('CS-06h: 生产环境中即使配置了白名单，验证码错误仍返回 false', async () => {
      mockConfigService = createMockConfigService(true, 'http://localhost:1421', 'production')
      mockRedis = createMockRedis({
        get: vi.fn().mockResolvedValue('ABCD'),
      })
      mockAuthRedis = {
        setex: vi.fn(async () => { }),
        get: vi.fn(async (key: string) => mockRedis.get(key)),
        del: vi.fn(async (key: string) => {
          mockRedis.del(key)
        }),
      }
      service = new CaptchaService(mockAuthRedis, mockConfigService)

      const ok = await service.verifyWithOrigin('http://localhost:1421', 'cid-1', 'wrong')
      expect(ok).toBe(false)
    })
  })

  describe('getImageById', () => {
    it('CS-05a: 基于 captchaId 返回 base64 解码后的 PNG Buffer', async () => {
      const pngBuf = Buffer.from('89504e470d0a', 'hex')
      mockRedis = createMockRedis({
        get: vi.fn().mockResolvedValue(pngBuf.toString('base64')),
      })
      mockAuthRedis = {
        setex: vi.fn(async () => { }),
        get: vi.fn(async (key: string) => mockRedis.get(key)),
        del: vi.fn(async () => { }),
      }
      service = new CaptchaService(mockAuthRedis, mockConfigService)

      const buf = await service.getImageById('cid-1')
      expect(buf).toBeInstanceOf(Buffer)
      expect(buf?.[0]).toBe(0x89)
      expect(mockAuthRedis.get).toHaveBeenCalledWith('captcha:img:cid-1')
    })

    it('CS-05b: Redis 未命中或 captchaId 为空返回 null', async () => {
      mockRedis = createMockRedis({
        get: vi.fn().mockResolvedValue(null),
      })
      mockAuthRedis = {
        setex: vi.fn(async () => { }),
        get: vi.fn(async (key: string) => mockRedis.get(key)),
        del: vi.fn(async () => { }),
      }
      service = new CaptchaService(mockAuthRedis, mockConfigService)

      expect(await service.getImageById('cid-miss')).toBeNull()
      expect(await service.getImageById('')).toBeNull()
    })
  })

  describe('peek', () => {
    it('CS-04a: 读取 Redis 中明文（仅调试/测试用）', async () => {
      mockRedis = createMockRedis({
        get: vi.fn().mockResolvedValue('WXYZ'),
      })
      mockAuthRedis = {
        setex: vi.fn(async () => { }),
        get: vi.fn(async (key: string) => mockRedis.get(key)),
        del: vi.fn(async () => { }),
      }
      service = new CaptchaService(mockAuthRedis, mockConfigService)

      const v = await service.peek('cid-1')
      expect(v).toBe('WXYZ')
    })
  })
})
