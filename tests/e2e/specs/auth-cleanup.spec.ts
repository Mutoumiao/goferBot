import { test, expect } from '@playwright/test'
import { deleteTestUser } from '../fixtures/auth'
import { Client } from 'pg'

const TEST_DB_URL =
  'postgresql://gofer:gofer_dev_pass@127.0.0.1:5432/goferbot_e2e?schema=public'

test.describe('AC-02: deleteTestUser 删除测试用户', () => {
  test.beforeEach(async () => {
    // 清理数据库，确保测试环境干净
    const client = new Client({ connectionString: TEST_DB_URL })
    await client.connect()
    await client.query("DELETE FROM users WHERE email LIKE 'delete-test-%'")
    await client.end()
  })

  test('按 email 删除测试用户', async () => {
    const client = new Client({ connectionString: TEST_DB_URL })
    await client.connect()

    const ts = Date.now()
    const email = `delete-test-${ts}@example.com`

    // 直接插入测试用户（使用参数化查询）
    await client.query(
      'INSERT INTO users (id, email, password, name, updated_at) VALUES ($1, $2, $3, $4, NOW())',
      [`delete-user-${ts}`, email, 'pass', 'Test'],
    )

    // 验证用户存在
    const before = await client.query('SELECT COUNT(*) FROM users WHERE email = $1', [email])
    expect(Number(before.rows[0].count)).toBe(1)

    await client.end()

    // 删除用户
    await deleteTestUser({ email })

    // 验证用户已删除
    const client2 = new Client({ connectionString: TEST_DB_URL })
    await client2.connect()
    const after = await client2.query('SELECT COUNT(*) FROM users WHERE email = $1', [email])
    expect(Number(after.rows[0].count)).toBe(0)
    await client2.end()
  })

  test('按 id 删除测试用户', async () => {
    const client = new Client({ connectionString: TEST_DB_URL })
    await client.connect()

    const ts = Date.now()
    const id = `delete-user-id-${ts}`
    const email = `delete-test-id-${ts}@example.com`

    // 直接插入测试用户（使用参数化查询）
    await client.query(
      'INSERT INTO users (id, email, password, name, updated_at) VALUES ($1, $2, $3, $4, NOW())',
      [id, email, 'pass', 'Test'],
    )

    await client.end()

    // 删除用户
    await deleteTestUser({ id })

    // 验证用户已删除
    const client2 = new Client({ connectionString: TEST_DB_URL })
    await client2.connect()
    const after = await client2.query('SELECT COUNT(*) FROM users WHERE id = $1', [id])
    expect(Number(after.rows[0].count)).toBe(0)
    await client2.end()
  })

  test('删除不存在的用户不抛错', async () => {
    await expect(deleteTestUser({ id: 'non-existent-id' })).resolves.not.toThrow()
    await expect(deleteTestUser({ email: 'non-existent@example.com' })).resolves.not.toThrow()
  })
})
