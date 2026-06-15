import { execSync } from 'child_process'
import { Client } from 'pg'
import path from 'path'

const schemaPath = path.resolve(process.cwd(), 'packages/server/prisma/schema.prisma')

export class TestDatabaseManager {
  async createDatabase(suffix: string): Promise<string> {
    const random = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const dbName = `goferbot_test_${suffix}_${random}`
    const adminUrl = process.env.TEST_DATABASE_ADMIN_URL
    if (!adminUrl) throw new Error('TEST_DATABASE_ADMIN_URL is not set')

    const client = new Client({ connectionString: adminUrl })
    await client.connect()
    await client.query(`CREATE DATABASE "${dbName}"`)
    await client.end()

    const adminUrlObj = new URL(adminUrl)
    adminUrlObj.pathname = `/${dbName}`
    adminUrlObj.search = '?schema=public'
    const dbUrl = adminUrlObj.toString()

    try {
      execSync(`pnpm --filter @goferbot/server exec prisma migrate deploy --schema=${schemaPath}`, {
        env: { ...process.env, DATABASE_URL: dbUrl },
        stdio: 'pipe',
      })
    } catch (err) {
      await this.dropDatabase(dbName)
      throw err
    }

    return dbUrl
  }

  async dropDatabase(dbName: string): Promise<void> {
    const adminUrl = process.env.TEST_DATABASE_ADMIN_URL
    if (!adminUrl) throw new Error('TEST_DATABASE_ADMIN_URL is not set')
    const client = new Client({ connectionString: adminUrl })
    await client.connect()
    await client.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`)
    await client.end()
  }
}
