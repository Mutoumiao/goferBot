import { describe, it, expect } from 'vitest'
import { TestDatabaseManager } from '../../integration/helpers/test-database.manager'

describe('TestDatabaseManager', () => {
  const manager = new TestDatabaseManager()

  it('AC-01: creates and drops a test database', async () => {
    const dbUrl = await manager.createDatabase('smoke')
    expect(dbUrl).toContain('goferbot_test_smoke_')
    expect(dbUrl).toContain('postgresql://')

    const dbName = new URL(dbUrl).pathname.replace('/', '')
    await expect(manager.dropDatabase(dbName)).resolves.toBeUndefined()
  })

  it('AC-01: migrate deploy creates expected tables', async () => {
    const dbUrl = await manager.createDatabase('schema')
    const { Client } = await import('pg')
    const client = new Client({ connectionString: dbUrl })
    await client.connect()
    const result = await client.query(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    `)
    await client.end()

    const tables = result.rows.map((r) => r.tablename)
    expect(tables).toContain('users')
    expect(tables).toContain('knowledge_bases')

    const dbName = new URL(dbUrl).pathname.replace('/', '')
    await manager.dropDatabase(dbName)
  })
})
