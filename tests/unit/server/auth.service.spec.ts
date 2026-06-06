import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthService } from '../../../packages/server/src/auth/auth.service.js'
import { UnauthorizedException, ForbiddenException } from '@nestjs/common'

describe('AuthService', () => {
  let authService: AuthService
  let mockJwtService: any
  let mockConfigService: any
  let mockUserService: any

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

    authService = new AuthService(mockJwtService, mockConfigService, mockUserService)
  })

  describe('register', () => {
    it('AC-03a: creates user and returns tokens for valid input', async () => {
      mockUserService.create.mockResolvedValue({
        id: 'u1', email: 'test@gofer.bot', name: 'Test',
      })

      const result = await authService.register('test@gofer.bot', 'password123')

      expect(result.user.email).toBe('test@gofer.bot')
      expect(result.accessToken).toBe('mock-token')
      expect(mockUserService.create).toHaveBeenCalledWith('test@gofer.bot', 'password123', undefined)
    })

    it('AC-03j: propagates ConflictException when email already exists', async () => {
      const conflictError = new Error('USER_EXISTS')
      conflictError.name = 'ConflictException'
      mockUserService.create.mockRejectedValue(conflictError)

      await expect(authService.register('exists@gofer.bot', 'password123'))
        .rejects.toThrow('USER_EXISTS')
    })
  })

  describe('login', () => {
    it('AC-03b: returns tokens for valid credentials', async () => {
      mockUserService.validatePassword.mockResolvedValue({
        id: 'u1', email: 'test@gofer.bot', isActive: true,
      })

      const result = await authService.login('test@gofer.bot', 'password123')

      expect(result.user.id).toBe('u1')
      expect(result.accessToken).toBe('mock-token')
    })

    it('AC-03c: throws ForbiddenException when account is disabled', async () => {
      mockUserService.validatePassword.mockResolvedValue({
        id: 'u1', email: 'test@gofer.bot', isActive: false,
      })

      await expect(authService.login('test@gofer.bot', 'password123'))
        .rejects.toThrow(ForbiddenException)
    })
  })

  describe('refresh', () => {
    it('AC-03d: returns new tokens for valid refresh token', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'u1', email: 'test@gofer.bot', type: 'refresh',
      })
      mockUserService.findById.mockResolvedValue({
        id: 'u1', email: 'test@gofer.bot', isActive: true,
      })

      const result = await authService.refresh('valid-refresh-token')

      expect(result.accessToken).toBe('mock-token')
      expect(mockJwtService.verify).toHaveBeenCalledWith('valid-refresh-token', expect.any(Object))
    })

    it('AC-03e: throws UnauthorizedException for invalid token type', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'u1', email: 'test@gofer.bot', type: 'access',
      })

      await expect(authService.refresh('access-token'))
        .rejects.toThrow(UnauthorizedException)
    })

    it('AC-03f: throws UnauthorizedException when user not found', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'u1', email: 'test@gofer.bot', type: 'refresh',
      })
      mockUserService.findById.mockResolvedValue(null)

      await expect(authService.refresh('valid-token'))
        .rejects.toThrow(UnauthorizedException)
    })

    it('AC-03g: throws UnauthorizedException for expired/invalid token', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired')
      })

      await expect(authService.refresh('expired-token'))
        .rejects.toThrow(UnauthorizedException)
    })
  })

  describe('me', () => {
    it('AC-03h: returns user profile for existing user', async () => {
      mockUserService.findById.mockResolvedValue({
        id: 'u1', email: 'test@gofer.bot',
      })

      const result = await authService.me('u1')

      expect(result.email).toBe('test@gofer.bot')
    })

    it('AC-03i: throws UnauthorizedException when user not found', async () => {
      mockUserService.findById.mockResolvedValue(null)

      await expect(authService.me('u1'))
        .rejects.toThrow(UnauthorizedException)
    })
  })
})
