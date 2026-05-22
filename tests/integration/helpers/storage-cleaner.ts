import { PrismaClient } from '@prisma/client'

export class StorageCleaner {
  async truncateAllTables(prisma: PrismaClient): Promise<void> {
    const result = await prisma.$queryRawUnsafe<{ tablename: string }[]>(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename != '_prisma_migrations'
    `)
    const tables = result.map((r) => `"${r.tablename}"`).join(', ')
    if (tables) {
      await prisma.$executeRawUnsafe(
        `TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`
      )
    }
  }
}
