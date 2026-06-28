import { AppException } from '@/lib/app-error.js'
import { UnauthorizedException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthService } from '@/auth/auth.service.js'

describe('AuthService', () => {
  let authService: AuthService
  let mockJwtService: any
  let mockConfigService: any
  let mockUserService: any
  let mockStorageService: any
  let mockAuthRedis: any
  let mockAuthRepository: any

  beforeEach(() => {
    mockJwtService = {
      sign: vi.fn().mockReturnValue('mock-token'),
      verify: vi.fn(),
    }
    mockConfigService = {
      get: vi.fn().mockReturnValue('15m'),
      getOrThrow: vi.fn().mockReturnValue('secret'),
    }
    mockUserService = {
      create: vi.fn(),
      validatePassword: vi.fn(),
      findById: vi.fn(),
    }
    mockStorageService = {}
    mockAuthRedis = {}
    mockAuthRepository = {
      createSession: vi.fn().mockResolvedValue({ id: 'session-1' }),
      insertRefreshToken: vi.fn().mockResolvedValue(undefined),
      findRefreshTokenByJtiHash: vi.fn(),
      markRefreshTokenUsed: vi.fn().mockResolvedValue({ id: 'rt-1', usedAt: new Date() }),
      revokeSession: vi.fn().mockResolvedValue(undefined),
      getRolesForUserByApp: vi.fn().mockResolvedValue([]),
    }

    authService = new AuthService(
      mockJwtService,
      mockConfigService,
      mockUserService,
      mockStorageService,
      mockAuthRedis,
      mockAuthRepository,
    )
  })

  describe('register', () => {
    it('AC-03a: creates user and returns tokens for valid input', async () => {
      mockUserService.create.mockResolvedValue({
        id: 'u1',
        email: 'test@gofer.bot',
        name: 'Test',
      })

      const result = await authService.register('test@gofer.bot', 'password123')

      expect(result.user.email).toBe('test@gofer.bot')
      expect(result.accessToken).toBe('mock-token')
      expect(mockUserService.create).toHaveBeenCalledWith(
        'test@gofer.bot',
        'password123',
        undefined,
      )
    })

    it('AC-03j: propagates ConflictException when email already exists', async () => {
      const conflictError = new Error('USER_EXISTS')
      conflictError.name = 'ConflictException'
      mockUserService.create.mockRejectedValue(conflictError)

      await expect(authService.register('exists@gofer.bot', 'password123')).rejects.toThrow(
        'USER_EXISTS',
      )
    })
  })

  describe('login', () => {
    it('AC-03b: returns tokens for valid credentials', async () => {
      mockUserService.validatePassword.mockResolvedValue({
        id: 'u1',
        email: 'test@gofer.bot',
        isActive: true,
      })
      mockAuthRepository.getRolesForUserByApp.mockResolvedValue([{ role: 'USER' }])

      const result = await authService.login('test@gofer.bot', 'password123', 'web')

      expect(result.user.id).toBe('u1')
      expect(result.accessToken).toBe('mock-token')
      expect(mockAuthRepository.getRolesForUserByApp).toHaveBeenCalledWith('u1', 'web')
    })

    it('AC-03c: throws AppException when account is disabled', async () => {
      mockUserService.validatePassword.mockResolvedValue({
        id: 'u1',
        email: 'test@gofer.bot',
        isActive: false,
      })

      await expect(authService.login('test@gofer.bot', 'password123', 'web')).rejects.toThrow(
        AppException,
      )
    })

    it('AC-03b-admin: returns tokens for admin with admin role', async () => {
      mockUserService.validatePassword.mockResolvedValue({
        id: 'u1',
        email: 'admin@gofer.bot',
        isActive: true,
      })
      mockAuthRepository.getRolesForUserByApp.mockResolvedValue([{ role: 'ADMIN' }])

      const result = await authService.login('admin@gofer.bot', 'password123', 'admin')

      expect(result.user.id).toBe('u1')
      expect(mockAuthRepository.getRolesForUserByApp).toHaveBeenCalledWith('u1', 'admin')
    })

    it('AC-03b-admin-deny: throws AppException when admin has no admin role', async () => {
      mockUserService.validatePassword.mockResolvedValue({
        id: 'u1',
        email: 'admin@gofer.bot',
        isActive: true,
      })
      mockAuthRepository.getRolesForUserByApp.mockResolvedValue([])

      await expect(authService.login('admin@gofer.bot', 'password123', 'admin')).rejects.toThrow(
        AppException,
      )
    })
  })

  describe('refresh', () => {
    it('AC-03d: returns new tokens for valid refresh token', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'u1',
        sid: 'session-1',
        app: 'web',
        jti: 'jti-1',
        type: 'refresh',
      })
      mockUserService.findById.mockResolvedValue({
        id: 'u1',
        email: 'test@gofer.bot',
        isActive: true,
      })
      mockAuthRepository.findRefreshTokenByJtiHash.mockResolvedValue({
        id: 'rt-1',
        jtiHash: 'hash-jti-1',
        sessionId: 'session-1',
        usedAt: null,
        revokedAt: null,
        session: { id: 'session-1', revokedAt: null },
      })

      const result = await authService.refresh('valid-refresh-token')

      expect(result.accessToken).toBe('mock-token')
      expect(result.refreshToken).toBe('mock-token')
      expect(mockJwtService.verify).toHaveBeenCalledWith('valid-refresh-token', expect.any(Object))
    })

    it('AC-03d-rot: marks old refresh token as used and creates new one', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'u1',
        sid: 'session-1',
        app: 'web',
        jti: 'jti-1',
        type: 'refresh',
      })
      mockUserService.findById.mockResolvedValue({
        id: 'u1',
        email: 'test@gofer.bot',
        isActive: true,
      })
      mockAuthRepository.findRefreshTokenByJtiHash.mockResolvedValue({
        id: 'rt-1',
        jtiHash: 'hash-jti-1',
        sessionId: 'session-1',
        usedAt: null,
        revokedAt: null,
        session: { id: 'session-1', revokedAt: null },
      })

      await authService.refresh('valid-refresh-token')

      expect(mockAuthRepository.markRefreshTokenUsed).toHaveBeenCalledTimes(1)
      expect(mockAuthRepository.insertRefreshToken).toHaveBeenCalledWith({
        sessionId: 'session-1',
        jtiHash: expect.any(String),
        parentTokenId: 'rt-1',
      })
    })

    it('AC-03d-race: revokes session when concurrent refresh race is lost', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'u1',
        sid: 'session-1',
        app: 'web',
        jti: 'jti-1',
        type: 'refresh',
      })
      mockUserService.findById.mockResolvedValue({
        id: 'u1',
        email: 'test@gofer.bot',
        isActive: true,
      })
      mockAuthRepository.findRefreshTokenByJtiHash.mockResolvedValue({
        id: 'rt-1',
        jtiHash: 'hash-jti-1',
        sessionId: 'session-1',
        usedAt: null,
        revokedAt: null,
        session: { id: 'session-1', revokedAt: null },
      })
      // 模拟并发竞争失败：另一个请求已经标记了此 token
      mockAuthRepository.markRefreshTokenUsed.mockResolvedValue(null)

      await expect(authService.refresh('valid-refresh-token')).rejects.toThrow(AppException)
      expect(mockAuthRepository.revokeSession).toHaveBeenCalledWith(
        'session-1',
        'token_replay_detected',
      )
    })

    it('AC-03d-replay: revokes session when refresh token is reused (replay attack)', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'u1',
        sid: 'session-1',
        app: 'web',
        jti: 'jti-1',
        type: 'refresh',
      })
      mockAuthRepository.findRefreshTokenByJtiHash.mockResolvedValue({
        id: 'rt-1',
        jtiHash: 'hash-jti-1',
        sessionId: 'session-1',
        usedAt: new Date(),
        revokedAt: null,
        session: { id: 'session-1', revokedAt: null },
      })

      await expect(authService.refresh('reused-token')).rejects.toThrow(AppException)
      expect(mockAuthRepository.revokeSession).toHaveBeenCalledWith(
        'session-1',
        'token_replay_detected',
      )
    })

    it('AC-03d-revoked: throws when refresh token is revoked', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'u1',
        sid: 'session-1',
        app: 'web',
        jti: 'jti-1',
        type: 'refresh',
      })
      mockAuthRepository.findRefreshTokenByJtiHash.mockResolvedValue({
        id: 'rt-1',
        jtiHash: 'hash-jti-1',
        sessionId: 'session-1',
        usedAt: null,
        revokedAt: new Date(),
        session: { id: 'session-1', revokedAt: null },
      })

      await expect(authService.refresh('revoked-token')).rejects.toThrow(AppException)
    })

    it('AC-03d-session-revoked: throws when session is revoked', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'u1',
        sid: 'session-1',
        app: 'web',
        jti: 'jti-1',
        type: 'refresh',
      })
      mockAuthRepository.findRefreshTokenByJtiHash.mockResolvedValue({
        id: 'rt-1',
        jtiHash: 'hash-jti-1',
        sessionId: 'session-1',
        usedAt: null,
        revokedAt: null,
        session: { id: 'session-1', revokedAt: new Date() },
      })

      await expect(authService.refresh('session-revoked-token')).rejects.toThrow(AppException)
    })

    it('AC-03e: throws AppException for invalid token type', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'u1',
        sid: 'session-1',
        app: 'web',
        jti: 'jti-1',
        type: 'access',
      })

      await expect(authService.refresh('access-token')).rejects.toThrow(AppException)
    })

    it('AC-03f: throws AppException when user not found', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'u1',
        sid: 'session-1',
        app: 'web',
        jti: 'jti-1',
        type: 'refresh',
      })
      mockUserService.findById.mockResolvedValue(null)

      await expect(authService.refresh('valid-token')).rejects.toThrow(AppException)
    })

    it('AC-03g: throws AppException for expired/invalid token', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired')
      })

      await expect(authService.refresh('expired-token')).rejects.toThrow(AppException)
    })
  })

  describe('generateTokens', () => {
    it('AC-03k: uses default expiresIn when config returns undefined', async () => {
      mockConfigService.get.mockReturnValue(undefined)
      mockUserService.validatePassword.mockResolvedValue({
        id: 'u1',
        email: 'test@gofer.bot',
        isActive: true,
      })

      const result = await authService.login('test@gofer.bot', 'password123', 'web')

      expect(result.accessToken).toBe('mock-token')
      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ expiresIn: '2h' }),
      )
    })

    it('AC-03l: falls back to safe default when JWT_EXPIRES_IN is invalid', async () => {
      mockConfigService.get.mockReturnValue('invalid')
      mockUserService.validatePassword.mockResolvedValue({
        id: 'u1',
        email: 'test@gofer.bot',
        isActive: true,
      })

      const result = await authService.login('test@gofer.bot', 'password123', 'web')

      expect(result.accessToken).toBe('mock-token')
      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ expiresIn: '2h' }),
      )
    })

    it('AC-03m: uses config value when JWT_EXPIRES_IN is valid', async () => {
      mockConfigService.get.mockReturnValue('30m')
      mockUserService.validatePassword.mockResolvedValue({
        id: 'u1',
        email: 'test@gofer.bot',
        isActive: true,
      })

      const result = await authService.login('test@gofer.bot', 'password123', 'web')

      expect(result.accessToken).toBe('mock-token')
      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ expiresIn: '30m' }),
      )
    })
  })

  describe('blacklistToken', () => {
    it('AC-03n: delegates to authRedis with parsed TTL', async () => {
      mockConfigService.get.mockReturnValue('2h')
      const mockAuthRedis = {
        blacklistToken: vi.fn().mockResolvedValue(undefined),
      } as any
      authService = new AuthService(
        mockJwtService,
        mockConfigService,
        mockUserService,
        mockStorageService,
        mockAuthRedis,
        mockAuthRepository,
      )

      await authService.blacklistToken('token-abc')

      expect(mockAuthRedis.blacklistToken).toHaveBeenCalledWith('token-abc', 7200)
    })

    it('AC-03o: defaults to 7200 seconds when config is missing', async () => {
      mockConfigService.get.mockReturnValue(undefined)
      const mockAuthRedis = {
        blacklistToken: vi.fn().mockResolvedValue(undefined),
      } as any
      authService = new AuthService(
        mockJwtService,
        mockConfigService,
        mockUserService,
        mockStorageService,
        mockAuthRedis,
        mockAuthRepository,
      )

      await authService.blacklistToken('token-abc')

      expect(mockAuthRedis.blacklistToken).toHaveBeenCalledWith('token-abc', 7200)
    })
  })

  describe('invalidateUserCache', () => {
    it('AC-03p: delegates to authRedis.invalidateUserCache', async () => {
      const mockAuthRedis = {
        invalidateUserCache: vi.fn().mockResolvedValue(undefined),
      } as any
      authService = new AuthService(
        mockJwtService,
        mockConfigService,
        mockUserService,
        mockStorageService,
        mockAuthRedis,
        mockAuthRepository,
      )

      await authService.invalidateUserCache('u1')

      expect(mockAuthRedis.invalidateUserCache).toHaveBeenCalledWith('u1')
    })
  })

  describe('me', () => {
    it('AC-03h: returns user profile for existing user', async () => {
      mockUserService.findById.mockResolvedValue({
        id: 'u1',
        email: 'test@gofer.bot',
      })

      const result = await authService.me('u1')

      expect(result.email).toBe('test@gofer.bot')
    })

    it('AC-03i: throws AppException when user not found', async () => {
      mockUserService.findById.mockResolvedValue(null)

      await expect(authService.me('u1')).rejects.toThrow(AppException)
    })
  })
})
