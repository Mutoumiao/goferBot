import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthRepository } from '@/auth/repositories/auth.repository.js'

describe('AuthRepository', () => {
  let authRepository: AuthRepository
  let mockPrismaService: any

  beforeEach(() => {
    mockPrismaService = {
      authSession: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      refreshToken: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      userRole: {
        findMany: vi.fn(),
      },
    }

    authRepository = new AuthRepository(mockPrismaService)
  })

  describe('createSession', () => {
    it('creates an auth session with required fields', async () => {
      const mockSession = { id: 'session-1', userId: 'u1', app: 'web' }
      mockPrismaService.authSession.create.mockResolvedValue(mockSession)

      const result = await authRepository.createSession({ userId: 'u1', app: 'web' })

      expect(result).toEqual(mockSession)
      expect(mockPrismaService.authSession.create).toHaveBeenCalledWith({
        data: {
          userId: 'u1',
          app: 'web',
          userAgent: undefined,
          ip: undefined,
        },
      })
    })

    it('creates an auth session with optional fields', async () => {
      const mockSession = {
        id: 'session-2',
        userId: 'u1',
        app: 'admin',
        userAgent: 'Mozilla/5.0',
        ip: '192.168.1.1',
      }
      mockPrismaService.authSession.create.mockResolvedValue(mockSession)

      const result = await authRepository.createSession({
        userId: 'u1',
        app: 'admin',
        userAgent: 'Mozilla/5.0',
        ip: '192.168.1.1',
      })

      expect(result).toEqual(mockSession)
      expect(mockPrismaService.authSession.create).toHaveBeenCalledWith({
        data: {
          userId: 'u1',
          app: 'admin',
          userAgent: 'Mozilla/5.0',
          ip: '192.168.1.1',
        },
      })
    })
  })

  describe('findSessionById', () => {
    it('returns session with refresh tokens by id', async () => {
      const mockSession = {
        id: 'session-1',
        userId: 'u1',
        refreshTokens: [{ id: 'rt-1' }],
      }
      mockPrismaService.authSession.findUnique.mockResolvedValue(mockSession)

      const result = await authRepository.findSessionById('session-1')

      expect(result).toEqual(mockSession)
      expect(mockPrismaService.authSession.findUnique).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        include: { refreshTokens: true },
      })
    })

    it('returns null when session not found', async () => {
      mockPrismaService.authSession.findUnique.mockResolvedValue(null)

      const result = await authRepository.findSessionById('non-existent')

      expect(result).toBeNull()
    })
  })

  describe('revokeSession', () => {
    it('updates session with revokedAt and revokedReason', async () => {
      const mockSession = {
        id: 'session-1',
        revokedAt: new Date('2024-01-01T00:00:00Z'),
        revokedReason: 'logout',
      }
      mockPrismaService.authSession.update.mockResolvedValue(mockSession)

      const result = await authRepository.revokeSession('session-1', 'logout')

      expect(result).toEqual(mockSession)
      expect(mockPrismaService.authSession.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: {
          revokedAt: expect.any(Date),
          revokedReason: 'logout',
        },
      })
    })
  })

  describe('insertRefreshToken', () => {
    it('creates a refresh token with sessionId and jtiHash', async () => {
      const mockToken = { id: 'rt-1', sessionId: 'session-1', jtiHash: 'hash-abc' }
      mockPrismaService.refreshToken.create.mockResolvedValue(mockToken)

      const result = await authRepository.insertRefreshToken({
        sessionId: 'session-1',
        jtiHash: 'hash-abc',
      })

      expect(result).toEqual(mockToken)
      expect(mockPrismaService.refreshToken.create).toHaveBeenCalledWith({
        data: {
          sessionId: 'session-1',
          jtiHash: 'hash-abc',
        },
      })
    })
  })

  describe('findRefreshTokenByJtiHash', () => {
    it('returns refresh token with session by jtiHash', async () => {
      const mockToken = {
        id: 'rt-1',
        jtiHash: 'hash-abc',
        session: { id: 'session-1' },
      }
      mockPrismaService.refreshToken.findUnique.mockResolvedValue(mockToken)

      const result = await authRepository.findRefreshTokenByJtiHash('hash-abc')

      expect(result).toEqual(mockToken)
      expect(mockPrismaService.refreshToken.findUnique).toHaveBeenCalledWith({
        where: { jtiHash: 'hash-abc' },
        include: { session: true },
      })
    })

    it('returns null when refresh token not found', async () => {
      mockPrismaService.refreshToken.findUnique.mockResolvedValue(null)

      const result = await authRepository.findRefreshTokenByJtiHash('non-existent')

      expect(result).toBeNull()
    })
  })

  describe('markRefreshTokenUsed', () => {
    it('updates refresh token with usedAt only', async () => {
      const mockToken = { id: 'rt-1', jtiHash: 'hash-abc', usedAt: new Date() }
      mockPrismaService.refreshToken.update.mockResolvedValue(mockToken)

      const result = await authRepository.markRefreshTokenUsed('hash-abc')

      expect(result).toEqual(mockToken)
      expect(mockPrismaService.refreshToken.update).toHaveBeenCalledWith({
        where: { jtiHash: 'hash-abc' },
        data: {
          usedAt: expect.any(Date),
          replacedByTokenId: undefined,
        },
      })
    })

    it('updates refresh token with usedAt and replacedByTokenId', async () => {
      const mockToken = {
        id: 'rt-1',
        jtiHash: 'hash-abc',
        usedAt: new Date(),
        replacedByTokenId: 'rt-2',
      }
      mockPrismaService.refreshToken.update.mockResolvedValue(mockToken)

      const result = await authRepository.markRefreshTokenUsed('hash-abc', 'rt-2')

      expect(result).toEqual(mockToken)
      expect(mockPrismaService.refreshToken.update).toHaveBeenCalledWith({
        where: { jtiHash: 'hash-abc' },
        data: {
          usedAt: expect.any(Date),
          replacedByTokenId: 'rt-2',
        },
      })
    })
  })

  describe('updateLastSeen', () => {
    it('updates session lastSeenAt to current date', async () => {
      const mockSession = { id: 'session-1', lastSeenAt: new Date() }
      mockPrismaService.authSession.update.mockResolvedValue(mockSession)

      const result = await authRepository.updateLastSeen('session-1')

      expect(result).toEqual(mockSession)
      expect(mockPrismaService.authSession.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: { lastSeenAt: expect.any(Date) },
      })
    })
  })

  describe('getRolesForUserByApp', () => {
    it('returns roles for user in specified app', async () => {
      const mockRoles = [{ role: 'USER' }, { role: 'ADMIN' }]
      mockPrismaService.userRole.findMany.mockResolvedValue(mockRoles)

      const result = await authRepository.getRolesForUserByApp('u1', 'web')

      expect(result).toEqual(mockRoles)
      expect(mockPrismaService.userRole.findMany).toHaveBeenCalledWith({
        where: { userId: 'u1', app: 'web' },
        select: { role: true },
      })
    })

    it('returns empty array when user has no roles in app', async () => {
      mockPrismaService.userRole.findMany.mockResolvedValue([])

      const result = await authRepository.getRolesForUserByApp('u1', 'admin')

      expect(result).toEqual([])
    })
  })
})
