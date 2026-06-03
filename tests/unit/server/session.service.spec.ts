import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaService } from '../../../packages/server/src/processors/database/prisma.service.js'
import { SessionService } from '../../../packages/server/src/modules/session/session.service.js'

describe('AC-02: list returns paginated result with items and pagination', () => {
  let prisma: PrismaService
  let service: SessionService
  let userId: string

  beforeAll(async () => {
    prisma = new PrismaService()
    await prisma.$connect()
    service = new SessionService(prisma)

    // 创建测试用户和会话
    const user = await prisma.user.create({
      data: { email: 'session-test@test.com', password: 'hash', name: 'Test' },
    })
    userId = user.id

    await prisma.session.createMany({
      data: Array.from({ length: 60 }, (_, i) => ({
        userId,
        title: `Session ${i}`,
      })),
    })
  })

  afterAll(async () => {
    await prisma.session.deleteMany({ where: { userId } })
    await prisma.user.delete({ where: { id: userId } })
    await prisma.$disconnect()
  })

  it('should return paginated sessions with default limit 50', async () => {
    const result = await service.list(userId, { page: 1, limit: 50 })

    expect(result.items).toHaveLength(50)
    expect(result.pagination.total).toBe(60)
    expect(result.pagination.size).toBe(50)
    expect(result.pagination.hasNextPage).toBe(true)
  })

  it('should return second page correctly', async () => {
    const result = await service.list(userId, { page: 2, limit: 50 })

    expect(result.items).toHaveLength(10)
    expect(result.pagination.currentPage).toBe(2)
    expect(result.pagination.hasPrevPage).toBe(true)
    expect(result.pagination.hasNextPage).toBe(false)
  })
})
