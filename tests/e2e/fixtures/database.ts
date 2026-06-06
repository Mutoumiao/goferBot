import { Client } from 'pg'

// TABLES_TO_TRUNCATE 与 Prisma schema 业务表对应关系：
// users → User, sessions → Session, messages → Message,
// knowledge_bases → KnowledgeBase, folders → Folder,
// documents → Document, chunks → Chunk, settings → Setting
// 注意：_prisma_migrations 不在列表中，避免破坏 migrate 状态
// 顺序已按外键依赖排列（子表先于父表），CASCADE 提供额外保障
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
  const dbUrl = process.env.DATABASE_URL || 'postgresql://gofer:gofer_dev_pass@127.0.0.1:5432/goferbot_e2e?schema=public'
  if (!dbUrl) throw new Error('DATABASE_URL is not set')

  const client = new Client({ connectionString: dbUrl })
  await client.connect()

  try {
    // 禁用外键约束检查，避免截断顺序问题
    await client.query('SET session_replication_role = replica')

    for (const table of TABLES_TO_TRUNCATE) {
      await client.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`)
    }

    await client.query('SET session_replication_role = DEFAULT')
  } finally {
    await client.end()
  }
}
