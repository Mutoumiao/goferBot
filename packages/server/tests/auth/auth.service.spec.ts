import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthService } from '@/auth/auth.service.js'
import { AppException } from '@/lib/app-error.js'

describe('AuthService', () => {
  let authService: AuthService
  let mockJwtService: any
  let mockConfigService: any
  let mockCookieHelper: any
  let mockAuthRepository: any
  let mockAuthRedis: any
  let mockRsaService: any
  let mockCaptchaService: any
  let mockUserService: any
  let mockPermissionService: any

  beforeEach(() => {
    mockJwtService = {
      sign: vi.fn().mockReturnValue('mock-token'),
      verify: vi.fn(),
    }
    mockConfigService = {
      get: vi.fn().mockReturnValue('15m'),
      getOrThrow: vi.fn().mockReturnValue('secret'),
    }
    mockCookieHelper = {
      setAuthCookies: vi.fn(),
      clearAuthCookies: vi.fn(),
    }
    mockUserService = {
      findById: vi.fn(),
    }
    mockAuthRedis = {
      blacklistToken: vi.fn().mockResolvedValue(undefined),
      invalidateUserCache: vi.fn().mockResolvedValue(undefined),
      cacheUserPermissions: vi.fn().mockResolvedValue(undefined),
    }
    mockRsaService = {
      decryptPassword: vi.fn().mockResolvedValue('decrypted-password'),
    }
    mockCaptchaService = {
      verify: vi.fn().mockResolvedValue(true),
    }
    mockAuthRepository = {
      insertRefreshToken: vi.fn().mockResolvedValue({ id: 'rt-2' }),
      findRefreshTokenByJtiHash: vi.fn(),
      markRefreshTokenUsed: vi.fn().mockResolvedValue(true),
      revokeSession: vi.fn().mockResolvedValue(undefined),
      getRolesForUserByApp: vi.fn().mockResolvedValue([{ role: 'user' }]),
      isAuthMethodEnabled: vi.fn().mockResolvedValue(true),
      createSession: vi.fn().mockResolvedValue({ id: 'session-1' }),
    }
    mockPermissionService = {
      getUserPermissions: vi.fn().mockResolvedValue([]),
    }

    authService = new AuthService(
      mockJwtService,
      mockConfigService,
      mockCookieHelper,
      mockAuthRepository,
      mockAuthRedis,
      mockRsaService,
      mockCaptchaService,
      mockUserService,
      mockPermissionService,
    )
  })

  describe('refresh', () => {
    it('AC-03d: returns new tokens for valid refresh token', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'u1',
        email: 'test@gofer.bot',
        sessionId: 'session-1',
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

      const result = await authService.refresh('web', 'valid-refresh-token')

      expect(result.accessToken).toBe('mock-token')
      expect(result.refreshToken).toBe('mock-token')
      expect(mockJwtService.verify).toHaveBeenCalledWith('valid-refresh-token', expect.any(Object))
      expect(mockAuthRepository.getRolesForUserByApp).toHaveBeenCalledWith('u1', 'web')
    })

    it('AC-03d-rot: marks old refresh token as used and creates new one', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'u1',
        email: 'test@gofer.bot',
        sessionId: 'session-1',
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

      await authService.refresh('web', 'valid-refresh-token')

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
      mockAuthRepository.markRefreshTokenUsed.mockResolvedValue(false)

      await expect(authService.refresh('web', 'valid-refresh-token')).rejects.toThrow(AppException)
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

      await expect(authService.refresh('web', 'reused-token')).rejects.toThrow(AppException)
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

      await expect(authService.refresh('web', 'revoked-token')).rejects.toThrow(AppException)
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

      await expect(authService.refresh('web', 'session-revoked-token')).rejects.toThrow(
        AppException,
      )
    })

    it('AC-03e: throws AppException for invalid token type', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'u1',
        sid: 'session-1',
        app: 'web',
        jti: 'jti-1',
        type: 'access',
      })

      await expect(authService.refresh('web', 'access-token')).rejects.toThrow(AppException)
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

      await expect(authService.refresh('web', 'valid-token')).rejects.toThrow(AppException)
    })

    it('AC-03g: throws AppException for expired/invalid token', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired')
      })

      await expect(authService.refresh('web', 'expired-token')).rejects.toThrow(AppException)
    })

    it('AC-03d-admin-role: revokes session when admin role is removed after token issued', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'u1',
        sid: 'session-1',
        app: 'admin',
        jti: 'jti-1',
        type: 'refresh',
      })
      mockUserService.findById.mockResolvedValue({
        id: 'u1',
        email: 'admin@gofer.bot',
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
      mockAuthRepository.getRolesForUserByApp.mockResolvedValue([])

      await expect(authService.refresh('admin', 'admin-refresh-token')).rejects.toThrow(
        AppException,
      )
      expect(mockAuthRepository.revokeSession).toHaveBeenCalledWith(
        'session-1',
        'admin_role_missing',
      )
    })
  })

  describe('blacklistToken', () => {
    it('AC-03n: delegates to authRedis with parsed TTL', async () => {
      mockConfigService.get.mockReturnValue('2h')
      await authService.blacklistToken('token-abc')
      expect(mockAuthRedis.blacklistToken).toHaveBeenCalledWith('token-abc', 7200)
    })

    it('AC-03o: defaults to 7200 seconds when config is missing', async () => {
      mockConfigService.get.mockReturnValue(undefined)
      await authService.blacklistToken('token-abc')
      expect(mockAuthRedis.blacklistToken).toHaveBeenCalledWith('token-abc', 7200)
    })
  })

  describe('invalidateUserCache', () => {
    it('AC-03p: delegates to authRedis.invalidateUserCache', async () => {
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

      const result = await authService.me('u1', 'web')

      expect(result.email).toBe('test@gofer.bot')
    })

    it('AC-03i: throws AppException when user not found', async () => {
      mockUserService.findById.mockResolvedValue(null)

      await expect(authService.me('u1', 'web')).rejects.toThrow(AppException)
    })
  })
})
