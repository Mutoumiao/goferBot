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
        updateMany: vi.fn(),
      },
      refreshToken: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      userRole: {
        findMany: vi.fn(),
      },
      $queryRaw: vi.fn(),
      application: {
        findUnique: vi.fn(),
      },
      applicationAuthMethod: {
        findUnique: vi.fn(),
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
          parentTokenId: undefined,
        },
      })
    })

    it('creates a refresh token with parentTokenId for rotation chain', async () => {
      const mockToken = {
        id: 'rt-2',
        sessionId: 'session-1',
        jtiHash: 'hash-def',
        parentTokenId: 'rt-1',
      }
      mockPrismaService.refreshToken.create.mockResolvedValue(mockToken)

      const result = await authRepository.insertRefreshToken({
        sessionId: 'session-1',
        jtiHash: 'hash-def',
        parentTokenId: 'rt-1',
      })

      expect(result).toEqual(mockToken)
      expect(mockPrismaService.refreshToken.create).toHaveBeenCalledWith({
        data: {
          sessionId: 'session-1',
          jtiHash: 'hash-def',
          parentTokenId: 'rt-1',
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
    beforeEach(() => {
      mockPrismaService.$queryRaw = vi.fn()
    })

    it('atomically updates refresh token with usedAt only and returns true', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ id: 'rt-1' }])

      const result = await authRepository.markRefreshTokenUsed('hash-abc')

      expect(result).toBe(true)
      expect(mockPrismaService.$queryRaw).toHaveBeenCalledOnce()
      const callArg = mockPrismaService.$queryRaw.mock.calls[0][0]
      // Prisma $queryRaw tagged template produces a Sql instance; verify SQL structure
      expect(String(callArg)).toContain('UPDATE "RefreshToken"')
      expect(String(callArg)).toContain('RETURNING "id"')
    })

    it('atomically updates refresh token with replacedByTokenId and returns true', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ id: 'rt-2' }])

      const result = await authRepository.markRefreshTokenUsed('hash-abc', 'rt-2')

      expect(result).toBe(true)
      expect(mockPrismaService.$queryRaw).toHaveBeenCalledOnce()
    })

    it('passes null for replacedByTokenId when omitted', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ id: 'rt-3' }])

      await authRepository.markRefreshTokenUsed('hash-abc')

      expect(mockPrismaService.$queryRaw).toHaveBeenCalledOnce()
      // Second argument should be null (not undefined) so SQL binds correctly
      const callArgs = mockPrismaService.$queryRaw.mock.calls[0]
      expect(callArgs.length).toBeGreaterThanOrEqual(1)
    })

    it('returns false when token is already used (concurrent race lost)', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([])

      const result = await authRepository.markRefreshTokenUsed('hash-abc')

      expect(result).toBe(false)
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
      const mockRoles = [{ roleCode: 'USER' }, { roleCode: 'ADMIN' }]
      mockPrismaService.userRole.findMany.mockResolvedValue(mockRoles)

      const result = await authRepository.getRolesForUserByApp('u1', 'web')

      expect(result).toEqual([{ role: 'USER' }, { role: 'ADMIN' }])
      expect(mockPrismaService.userRole.findMany).toHaveBeenCalledWith({
        where: { userId: 'u1', app: 'web' },
        select: { roleCode: true },
      })
    })

    it('returns empty array when user has no roles in app', async () => {
      mockPrismaService.userRole.findMany.mockResolvedValue([])

      const result = await authRepository.getRolesForUserByApp('u1', 'admin')

      expect(result).toEqual([])
    })
  })

  describe('isAuthMethodEnabled', () => {
    it('returns true when application is active and method is enabled', async () => {
      mockPrismaService.application.findUnique.mockResolvedValue({ id: 'app-1', status: 'active' })
      mockPrismaService.applicationAuthMethod.findUnique.mockResolvedValue({ enabled: true })

      const result = await authRepository.isAuthMethodEnabled('web', 'password')

      expect(result).toBe(true)
      expect(mockPrismaService.application.findUnique).toHaveBeenCalledWith({
        where: { code: 'web' },
        select: { id: true, status: true },
      })
      expect(mockPrismaService.applicationAuthMethod.findUnique).toHaveBeenCalledWith({
        where: { applicationId_provider: { applicationId: 'app-1', provider: 'password' } },
        select: { enabled: true },
      })
    })

    it('returns false when application is inactive', async () => {
      mockPrismaService.application.findUnique.mockResolvedValue({
        id: 'app-1',
        status: 'inactive',
      })

      const result = await authRepository.isAuthMethodEnabled('web', 'password')

      expect(result).toBe(false)
      expect(mockPrismaService.applicationAuthMethod.findUnique).not.toHaveBeenCalled()
    })

    it('returns false when application does not exist', async () => {
      mockPrismaService.application.findUnique.mockResolvedValue(null)

      const result = await authRepository.isAuthMethodEnabled('unknown', 'password')

      expect(result).toBe(false)
      expect(mockPrismaService.applicationAuthMethod.findUnique).not.toHaveBeenCalled()
    })

    it('returns false when method is disabled', async () => {
      mockPrismaService.application.findUnique.mockResolvedValue({ id: 'app-1', status: 'active' })
      mockPrismaService.applicationAuthMethod.findUnique.mockResolvedValue({ enabled: false })

      const result = await authRepository.isAuthMethodEnabled('web', 'password')

      expect(result).toBe(false)
    })

    it('returns false when method is not configured', async () => {
      mockPrismaService.application.findUnique.mockResolvedValue({ id: 'app-1', status: 'active' })
      mockPrismaService.applicationAuthMethod.findUnique.mockResolvedValue(null)

      const result = await authRepository.isAuthMethodEnabled('web', 'sso')

      expect(result).toBe(false)
    })
  })
})
