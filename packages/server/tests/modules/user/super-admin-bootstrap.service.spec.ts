import { ConfigService } from '@nestjs/config'
import { beforeEach, describe, expect, it, Mock, vi } from 'vitest'
import { SuperAdminBootstrapService } from '../../../src/modules/user/services/super-admin-bootstrap.service.js'
import { PrismaService } from '../../../src/processors/database/prisma.service.js'

describe('SuperAdminBootstrapService', () => {
  let service: SuperAdminBootstrapService
  let mockPrismaService: {
    user: {
      findFirst: Mock
      count: Mock
      create: Mock
    }
    userRole: {
      createMany: Mock
    }
    systemFlag: {
      findUnique: Mock
      upsert: Mock
    }
    application: {
      upsert: Mock
      findUnique: Mock
    }
    applicationAuthMethod: {
      upsert: Mock
    }
    adminAuditLog: {
      create: Mock
    }
    $transaction: Mock
  }
  let mockConfigService: {
    get: Mock
  }

  beforeEach(() => {
    mockPrismaService = {
      user: {
        findFirst: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
      },
      userRole: {
        createMany: vi.fn(),
      },
      systemFlag: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
      },
      application: {
        upsert: vi.fn().mockResolvedValue({ id: 'app-id', code: 'admin', status: 'active' }),
        findUnique: vi.fn().mockResolvedValue({ id: 'app-id', code: 'admin', status: 'active' }),
      },
      applicationAuthMethod: {
        upsert: vi.fn().mockResolvedValue({}),
      },
      adminAuditLog: {
        create: vi.fn(),
      },
      $transaction: vi.fn((work: Function) =>
        work({
          user: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({ id: 'test-user-id' }),
          },
          userRole: { createMany: vi.fn().mockResolvedValue({ count: 2 }) },
          systemFlag: {
            findUnique: vi.fn().mockResolvedValue(null),
            upsert: vi.fn().mockResolvedValue({}),
          },
          adminAuditLog: { create: vi.fn().mockResolvedValue({}) },
        }),
      ),
    }

    mockConfigService = {
      get: vi.fn((key: string) => {
        if (key === 'SUPER_ADMIN_EMAIL') return 'admin@test.com'
        if (key === 'SUPER_ADMIN_PASSWORD') return 'Password123'
        if (key === 'BCRYPT_SALT_ROUNDS') return 10
        return undefined
      }),
    }

    service = new SuperAdminBootstrapService(
      mockPrismaService as unknown as PrismaService,
      mockConfigService as unknown as ConfigService,
    )
  })

  describe('bootstrap', () => {
    it('should skip if email or password is not configured', async () => {
      mockConfigService.get = vi.fn().mockReturnValue(undefined)
      await service.bootstrap()
      expect(mockPrismaService.user.findFirst).not.toHaveBeenCalled()
    })

    it('should skip if super admin already exists', async () => {
      mockPrismaService.user.findFirst = vi.fn().mockResolvedValue({ id: 'existing-user-id' })
      await service.bootstrap()
      expect(mockPrismaService.user.count).not.toHaveBeenCalled()
    })

    it('should log warning if other users exist but no super admin', async () => {
      mockPrismaService.user.findFirst = vi.fn().mockResolvedValue(null)
      mockPrismaService.user.count = vi.fn().mockResolvedValue(5)
      const tx = {
        user: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: 'new-user-id' }),
        },
        userRole: { createMany: vi.fn().mockResolvedValue({ count: 2 }) },
        systemFlag: {
          findUnique: vi.fn().mockResolvedValue({ updatedAt: new Date(Date.now() - 1000) }),
          upsert: vi.fn().mockResolvedValue({}),
        },
        adminAuditLog: { create: vi.fn().mockResolvedValue({}) },
      }
      mockPrismaService.$transaction = vi.fn(async (work: Function) => work(tx))
      await service.bootstrap()
      expect(tx.user.create).not.toHaveBeenCalled()
    })

    it('should create super admin successfully if no users exist', async () => {
      mockPrismaService.user.findFirst = vi.fn().mockResolvedValue(null)
      mockPrismaService.user.count = vi.fn().mockResolvedValue(0)

      mockPrismaService.$transaction = vi.fn(async (work: Function) => {
        const tx = {
          user: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({ id: 'new-user-id' }),
          },
          userRole: { createMany: vi.fn().mockResolvedValue({ count: 2 }) },
          systemFlag: {
            findUnique: vi.fn().mockResolvedValue(null),
            upsert: vi.fn().mockResolvedValue({}),
          },
          adminAuditLog: { create: vi.fn().mockResolvedValue({}) },
        }
        await work(tx)
      })

      await service.bootstrap()

      expect(mockPrismaService.$transaction).toHaveBeenCalled()
    })

    it('should handle P2002 unique constraint violation gracefully', async () => {
      mockPrismaService.user.findFirst = vi.fn().mockResolvedValue(null)
      mockPrismaService.user.count = vi.fn().mockResolvedValue(0)

      const p2002Error = { code: 'P2002', message: 'Unique constraint failed' }
      mockPrismaService.$transaction = vi.fn().mockRejectedValue(p2002Error)

      // Should not throw
      await expect(service.bootstrap()).resolves.not.toThrow()
    })

    it('should rethrow other errors', async () => {
      mockPrismaService.user.findFirst = vi.fn().mockResolvedValue(null)
      mockPrismaService.user.count = vi.fn().mockResolvedValue(0)

      const otherError = new Error('Database connection failed')
      mockPrismaService.$transaction = vi.fn().mockRejectedValue(otherError)

      await expect(service.bootstrap()).rejects.toThrow(otherError)
    })
  })
})
