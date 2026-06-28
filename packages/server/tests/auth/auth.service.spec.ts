import { ForbiddenException, UnauthorizedException } from '@nestjs/common'
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

      const result = await authService.login('test@gofer.bot', 'password123', 'web')

      expect(result.user.id).toBe('u1')
      expect(result.accessToken).toBe('mock-token')
    })

    it('AC-03c: throws ForbiddenException when account is disabled', async () => {
      mockUserService.validatePassword.mockResolvedValue({
        id: 'u1',
        email: 'test@gofer.bot',
        isActive: false,
      })

      await expect(authService.login('test@gofer.bot', 'password123', 'web')).rejects.toThrow(
        ForbiddenException,
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

      const result = await authService.refresh('valid-refresh-token')

      expect(result.accessToken).toBe('mock-token')
      expect(mockJwtService.verify).toHaveBeenCalledWith('valid-refresh-token', expect.any(Object))
    })

    it('AC-03e: throws UnauthorizedException for invalid token type', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'u1',
        sid: 'session-1',
        app: 'web',
        jti: 'jti-1',
        type: 'access',
      })

      await expect(authService.refresh('access-token')).rejects.toThrow(UnauthorizedException)
    })

    it('AC-03f: throws UnauthorizedException when user not found', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'u1',
        sid: 'session-1',
        app: 'web',
        jti: 'jti-1',
        type: 'refresh',
      })
      mockUserService.findById.mockResolvedValue(null)

      await expect(authService.refresh('valid-token')).rejects.toThrow(UnauthorizedException)
    })

    it('AC-03g: throws UnauthorizedException for expired/invalid token', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired')
      })

      await expect(authService.refresh('expired-token')).rejects.toThrow(UnauthorizedException)
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

    it('AC-03i: throws UnauthorizedException when user not found', async () => {
      mockUserService.findById.mockResolvedValue(null)

      await expect(authService.me('u1')).rejects.toThrow(UnauthorizedException)
    })
  })
})
