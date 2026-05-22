import { describe, it, expect } from 'vitest'
import { TestAppFactory } from '../../integration/helpers/test-app.factory'
import { TestDatabaseManager } from '../../integration/helpers/test-database.manager'

describe('TestAppFactory', () => {
  const dbManager = new TestDatabaseManager()

  it('AC-02: creates NestJS app with overridden PrismaService', async () => {
    const dbUrl = await dbManager.createDatabase('appfactory')
    const app = await TestAppFactory.create(dbUrl)

    expect(app).toBeDefined()

    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)

    await app.close()
    const dbName = new URL(dbUrl).pathname.replace('/', '')
    await dbManager.dropDatabase(dbName)
  })
})
