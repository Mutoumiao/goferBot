import { test, expect } from '@playwright/test'
import { cleanupDatabase } from '../fixtures/database'
import { Client } from 'pg'

const TEST_DB_URL =
  'postgresql://gofer:gofer_dev_pass@127.0.0.1:5432/goferbot_e2e?schema=public'

test.describe('AC-01: cleanupDatabase 清理所有业务表', () => {
  test.beforeEach(async () => {
    await cleanupDatabase()
  })

  test('清理后所有业务表记录数为 0', async () => {
    const client = new Client({ connectionString: TEST_DB_URL })
    await client.connect()

    const ts = Date.now()

    // 先插入测试数据
    await client.query(
      `INSERT INTO users (id, email, password, name, updated_at) VALUES ('test-user-${ts}', 'test${ts}@example.com', 'pass', 'Test', NOW())`,
    )
    await client.query(
      `INSERT INTO sessions (id, user_id, title, updated_at) VALUES ('test-session-${ts}', 'test-user-${ts}', 'Test Session', NOW())`,
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

  test('AC-05: 连续运行两次 cleanupDatabase 不报错', async () => {
    await cleanupDatabase()
    await expect(cleanupDatabase()).resolves.not.toThrow()
  })
})
