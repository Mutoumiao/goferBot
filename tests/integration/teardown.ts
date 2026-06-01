import { PrismaClient } from '@prisma/client'

let prisma: PrismaClient | null = null

export async function cleanupTestData(): Promise<void> {
  if (!prisma) {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    })
  }

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

export async function disconnectTeardown(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect()
    prisma = null
  }
}
