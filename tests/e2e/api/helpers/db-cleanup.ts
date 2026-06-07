/**
 * E2E 数据库清理工具
 * 每例测试前 DELETE 清理共享测试数据库
 */
import { Client } from 'pg'

const TABLES_TO_TRUNCATE = [
  'chunks',
  'messages',
  'sessions',
  'documents',
  'folders',
  'knowledge_bases',
  'settings',
  'users',
]

export async function cleanupDatabase(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL || 'postgresql://gofer:gofer_dev_pass@127.0.0.1:5432/goferbot_test?schema=public'
  if (!dbUrl) throw new Error('DATABASE_URL is not set')

  const client = new Client({ connectionString: dbUrl })
  await client.connect()

  try {
    // 使用 DELETE 而非 TRUNCATE，避免与 NestJS 应用连接发生锁冲突
    // 同时禁用触发器，防止外键约束在删除顺序不当时报错
    await client.query('SET session_replication_role = replica')
    for (const table of TABLES_TO_TRUNCATE) {
      await client.query(`DELETE FROM "${table}"`)
    }
    await client.query('SET session_replication_role = DEFAULT')
  } finally {
    await client.end()
  }
}
