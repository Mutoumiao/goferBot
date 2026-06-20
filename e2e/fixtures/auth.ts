/**
 * E2E 测试用户管理 fixture
 *
 * 提供测试用户创建、删除和数据库清理功能。
 * 使用 goferbot_e2e 数据库（由 .env.e2e 配置）。
 */
import { Client } from 'pg'

export interface TestUser {
  id: string
  name: string
  email: string
  password: string
}

const E2E_DATABASE_URL =
  'postgresql://gofer:gofer_dev_pass@127.0.0.1:5432/goferbot_e2e?schema=public'
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000'

/**
 * 通过 API 注册创建测试用户
 */
export async function createTestUser(): Promise<TestUser> {
  const timestamp = Date.now()
  const random = Math.random().toString(36).slice(2, 8)
  const name = `E2E Test User ${timestamp}`
  const email = `e2e.${timestamp}.${random}@test.gofer`
  const password = 'Test123!@#'

  const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to create test user: ${response.status} ${error}`)
  }

  const result = (await response.json()) as { data?: { user?: { id: string } } }
  const userId = result.data?.user?.id

  if (!userId) {
    throw new Error('User ID not returned from register API')
  }

  return { id: userId, name, email, password }
}

/**
 * 通过 API 删除测试用户
 */
export async function deleteTestUser(identifier: { email?: string; id?: string }): Promise<void> {
  // 优先通过 id 删除，否则通过 email 查询后删除
  let userId = identifier.id

  if (!userId && identifier.email) {
    // 查询用户 ID
    const client = new Client({ connectionString: E2E_DATABASE_URL })
    try {
      await client.connect()
      const res = await client.query<{ id: string }>('SELECT id FROM users WHERE email = $1', [
        identifier.email,
      ])
      if (res.rows.length > 0) {
        userId = res.rows[0].id
      }
    } finally {
      await client.end()
    }
  }

  if (!userId) {
    // 用户不存在，视为成功
    return
  }

  // 通过 Admin API 删除用户
  const response = await fetch(`${API_BASE_URL}/api/admin/users/${userId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  })

  // 204 No Content 或 404 Not Found 都视为成功
  if (!response.ok && response.status !== 404) {
    const error = await response.text()
    throw new Error(`Failed to delete test user: ${response.status} ${error}`)
  }
}

/**
 * 清理 goferbot_e2e 数据库中所有业务表的数据
 * 按依赖顺序 TRUNCATE，避免外键约束失败
 */
export async function cleanupDatabase(): Promise<void> {
  const client = new Client({ connectionString: E2E_DATABASE_URL })
  try {
    await client.connect()

    // 按依赖顺序清理表（从依赖最少到最多）
    // 注意：有些表可能有外键依赖，需要考虑 CASCADE
    const tables = [
      'messages',
      'sessions',
      'chunks',
      'documents',
      'folders',
      'knowledge_bases',
      'settings',
      'users',
    ]

    // 使用 CASCADE 确保外键约束被正确处理
    for (const table of tables) {
      await client.query(`TRUNCATE TABLE "${table}" CASCADE`)
    }

    console.log('[cleanupDatabase] All tables truncated successfully')
  } finally {
    await client.end()
  }
}
