import { ConfigService } from '@nestjs/config'
import { beforeEach, describe, expect, it, Mock, vi } from 'vitest'
import { SuperAdminBootstrapService } from '../../../src/modules/user/services/super-admin-bootstrap.service.js'
import { PrismaService } from '../../../src/processors/database/prisma.service.js'

function createTxMock(overrides: Partial<ReturnType<typeof createTxMockBase>> = {}) {
  return { ...createTxMockBase(), ...overrides }
}

function createTxMockBase() {
  return {
    user: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'new-user-id' }),
    },
    userRole: {
      findFirst: vi.fn().mockResolvedValue(null),
      createMany: vi.fn().mockResolvedValue({ count: 3 }),
    },
    systemFlag: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue({}),
    },
    application: {
      upsert: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue({ id: 'app-id' }),
    },
    applicationAuthMethod: {
      upsert: vi.fn().mockResolvedValue({}),
    },
    role: {
      upsert: vi.fn().mockResolvedValue({}),
    },
    adminAuditLog: {
      create: vi.fn().mockResolvedValue({}),
    },
  }
}

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
    role: {
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
      role: {
        upsert: vi.fn().mockResolvedValue({}),
      },
      adminAuditLog: {
        create: vi.fn(),
      },
      $transaction: vi.fn((work: Function) => work(createTxMock())),
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
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled()
    })

    it('should skip within transaction if super admin role already exists', async () => {
      const tx = createTxMock({
        userRole: {
          findFirst: vi.fn().mockResolvedValue({ userId: 'existing-id' }),
          createMany: vi.fn(),
        },
      })
      mockPrismaService.$transaction = vi.fn(async (work: Function) => work(tx))

      await service.bootstrap()
      // Should not create user since super admin role already exists
      expect(tx.user.create).not.toHaveBeenCalled()
      expect(tx.userRole.createMany).not.toHaveBeenCalled()
    })

    it('should skip if boot lock is held by another instance', async () => {
      const tx = createTxMock({
        systemFlag: {
          findUnique: vi.fn().mockResolvedValue({
            updatedAt: new Date(Date.now() - 2000), // within 30s lock window
          }),
          upsert: vi.fn(),
        },
      })
      mockPrismaService.$transaction = vi.fn(async (work: Function) => work(tx))

      await service.bootstrap()
      expect(tx.user.create).not.toHaveBeenCalled()
    })

    it('should create super admin successfully if none exists', async () => {
      await service.bootstrap()
      expect(mockPrismaService.$transaction).toHaveBeenCalled()
    })

    it('should handle P2002 by throwing it upward', async () => {
      mockConfigService.get = vi.fn((key: string) => {
        if (key === 'SUPER_ADMIN_EMAIL') return 'admin@test.com'
        if (key === 'SUPER_ADMIN_PASSWORD') return 'Password123'
        if (key === 'BCRYPT_SALT_ROUNDS') return 10
        return undefined
      })

      const p2002Error = { code: 'P2002', message: 'Unique constraint failed' }
      mockPrismaService.$transaction = vi.fn().mockRejectedValue(p2002Error)

      // P2002 is not caught by the service — it propagates naturally
      await expect(service.bootstrap()).rejects.toEqual(p2002Error)
    })

    it('should rethrow other errors', async () => {
      const otherError = new Error('Database connection failed')
      mockPrismaService.$transaction = vi.fn().mockRejectedValue(otherError)

      await expect(service.bootstrap()).rejects.toThrow(otherError)
    })
  })
})
