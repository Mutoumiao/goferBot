import type { PrismaClient } from '@prisma/client'

export async function cleanupTestData(prisma: PrismaClient): Promise<void> {
  // 按依赖顺序清理测试数据
  await prisma.$executeRaw`TRUNCATE TABLE messages CASCADE`
  await prisma.$executeRaw`TRUNCATE TABLE sessions CASCADE`
  await prisma.$executeRaw`TRUNCATE TABLE chunks CASCADE`
  await prisma.$executeRaw`TRUNCATE TABLE documents CASCADE`
  await prisma.$executeRaw`TRUNCATE TABLE folders CASCADE`
  await prisma.$executeRaw`TRUNCATE TABLE knowledge_bases CASCADE`
  await prisma.$executeRaw`TRUNCATE TABLE settings CASCADE`
  await prisma.$executeRaw`TRUNCATE TABLE users CASCADE`
}
