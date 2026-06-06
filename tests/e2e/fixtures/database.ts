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
