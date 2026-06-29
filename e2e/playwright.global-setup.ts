/**
 * Playwright globalSetup: 在所有 E2E 测试开始前初始化数据库。
 *
 * 职责：
 * 1. 验证 goferbot_e2e 数据库连接
 * 2. 返回 teardown 函数用于测试结束后的清理
 *
 * 注意：数据库 schema 应该在测试前已经通过 `pnpm --filter @goferbot/server prisma migrate dev` 初始化。
 * globalSetup 只负责验证连接，不阻塞测试继续。
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from 'pg'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const E2E_DATABASE_URL =
  'postgresql://gofer:gofer_dev_pass@127.0.0.1:5432/goferbot_e2e?schema=public'

export default async function globalSetup(): Promise<() => Promise<void>> {
  // 验证数据库连接
  try {
    const client = new Client({ connectionString: E2E_DATABASE_URL })
    await client.connect()
    await client.query('SELECT 1')
    await client.end()
    console.log('[globalSetup] Database connection verified')
  } catch (err) {
    console.error('[globalSetup] Database connection failed:', err)
    // 不阻塞测试继续
  }

  // 返回 teardown 函数
  return async function teardown(): Promise<void> {
    // Playwright 的 globalTeardown 会单独调用 playwright.global-teardown.ts
  }
}
