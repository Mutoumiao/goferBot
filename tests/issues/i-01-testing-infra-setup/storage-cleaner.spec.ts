import { describe, it, expect } from 'vitest'
import { StorageCleaner } from '../../integration/helpers/storage-cleaner'
import { PrismaClient } from '@prisma/client'
import { TestDatabaseManager } from '../../integration/helpers/test-database.manager'

describe('StorageCleaner', () => {
  const manager = new TestDatabaseManager()
  const cleaner = new StorageCleaner()

  it('AC-05: truncates all tables and restarts identity', async () => {
    const dbUrl = await manager.createDatabase('cleaner')
    const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } })

    await prisma.user.create({
      data: { email: 'test@gofer.bot', password: 'hash', name: 'Test' },
    })
    const before = await prisma.user.count()
    expect(before).toBe(1)

    await cleaner.truncateAllTables(prisma)
    const after = await prisma.user.count()
    expect(after).toBe(0)

    await prisma.$disconnect()
    const dbName = new URL(dbUrl).pathname.replace('/', '')
    await manager.dropDatabase(dbName)
  })
})
