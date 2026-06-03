import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaService } from '../../../packages/server/src/processors/database/prisma.service.js'

describe('AC-01: paginate returns correct data and pagination metadata', () => {
  let prisma: PrismaService

  beforeAll(async () => {
    prisma = new PrismaService()
    await prisma.$connect()
    // 清理并插入测试数据（使用随机后缀避免并行冲突）
    const suffix = `paginate-${Date.now()}`
    await prisma.user.deleteMany({ where: { email: { contains: suffix } } })
    await prisma.user.createMany({
      data: Array.from({ length: 25 }, (_, i) => ({
        email: `user${i}@${suffix}.gofer`,
        password: 'hash',
        name: `User ${i}`,
      })),
    })
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('should return paginated result with correct metadata', async () => {
    const suffix = `paginate-${Date.now()}`
    await prisma.user.deleteMany({ where: { email: { contains: suffix } } })
    await prisma.user.createMany({
      data: Array.from({ length: 25 }, (_, i) => ({
        email: `user${i}@${suffix}.gofer`,
        password: 'hash',
        name: `User ${i}`,
      })),
    })

    const result = await (prisma.user as any).paginate(
      { where: { email: { contains: suffix } }, orderBy: { createdAt: 'desc' } },
      { page: 1, size: 10 },
    )

    expect(result.data).toHaveLength(10)
    expect(result.pagination.total).toBe(25)
    expect(result.pagination.size).toBe(10)
    expect(result.pagination.currentPage).toBe(1)
    expect(result.pagination.totalPage).toBe(3)
    expect(result.pagination.hasNextPage).toBe(true)
    expect(result.pagination.hasPrevPage).toBe(false)
  })

  it('should return empty array for out-of-range page', async () => {
    const suffix = `paginate-${Date.now()}`
    await prisma.user.deleteMany({ where: { email: { contains: suffix } } })
    await prisma.user.createMany({
      data: Array.from({ length: 5 }, (_, i) => ({
        email: `user${i}@${suffix}.gofer`,
        password: 'hash',
        name: `User ${i}`,
      })),
    })

    const result = await (prisma.user as any).paginate(
      { where: { email: { contains: suffix } }, orderBy: { createdAt: 'desc' } },
      { page: 10, size: 10 },
    )

    expect(result.data).toHaveLength(0)
    expect(result.pagination.hasNextPage).toBe(false)
  })

  it('should check existence with exists()', async () => {
    const suffix = `exists-${Date.now()}`
    await prisma.user.create({
      data: { email: `test@${suffix}.gofer`, password: 'hash', name: 'Test' },
    })

    const exists = await (prisma.user as any).exists({
      where: { email: `test@${suffix}.gofer` },
    })
    expect(exists).toBe(true)

    const notExists = await (prisma.user as any).exists({
      where: { email: 'nonexistent@test.com' },
    })
    expect(notExists).toBe(false)
  })
})
