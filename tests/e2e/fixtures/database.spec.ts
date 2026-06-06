import { describe, it, expect } from 'vitest'
import { cleanupDatabase } from './database'
import { Client } from 'pg'

const TEST_DB_URL =
  process.env.DATABASE_URL ||
  'postgresql://gofer:gofer_dev_pass@127.0.0.1:5432/goferbot_e2e?schema=public'

describe('cleanupDatabase', () => {
  it('AC-01: 清理后所有业务表记录数为 0', async () => {
    const client = new Client({ connectionString: TEST_DB_URL })
    await client.connect()

    // 先插入测试数据
    await client.query(
      "INSERT INTO users (id, email, password, name) VALUES ('test-user-1', 'test1@example.com', 'pass', 'Test')",
    )
    await client.query(
      "INSERT INTO sessions (id, user_id, title) VALUES ('test-session-1', 'test-user-1', 'Test Session')",
    )

    await cleanupDatabase()

    const tables = [
      'users',
      'sessions',
      'messages',
      'knowledge_bases',
      'folders',
      'documents',
      'chunks',
      'settings',
    ]
    for (const table of tables) {
      const res = await client.query(`SELECT COUNT(*) FROM ${table}`)
      expect(Number(res.rows[0].count)).toBe(0)
    }

    await client.end()
  })

  it('AC-05: 连续运行两次 cleanupDatabase 不报错', async () => {
    await cleanupDatabase()
    await expect(cleanupDatabase()).resolves.not.toThrow()
  })
})
