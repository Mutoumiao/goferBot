import { execSync } from 'child_process'
import { Client } from 'pg'

async function waitForPostgres(url: string, timeout = 60000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    try {
      const client = new Client({ connectionString: url })
      await client.connect()
      await client.query('SELECT 1')
      await client.end()
      return
    } catch {
      await new Promise((r) => setTimeout(r, 500))
    }
  }
  throw new Error('Postgres not ready within timeout')
}

export default async function globalSetup() {
  // 1. 启动 docker 基础设施
  console.log('[E2E] Starting docker infrastructure...')
  execSync('pnpm infra:up', { stdio: 'inherit' })

  // 2. 等待 postgres 就绪
  const adminUrl = process.env.TEST_DATABASE_ADMIN_URL || 'postgresql://gofer:gofer_dev_pass@127.0.0.1:5432/postgres?schema=public'
  await waitForPostgres(adminUrl)
  console.log('[E2E] Postgres is ready')

  // 3. 创建 E2E 数据库（若不存在）
  const adminClient = new Client({ connectionString: adminUrl })
  await adminClient.connect()
  const dbName = 'goferbot_e2e'
  const dbExists = await adminClient.query(`SELECT 1 FROM pg_database WHERE datname = '${dbName}'`)
  if (dbExists.rowCount === 0) {
    console.log(`[E2E] Creating database ${dbName}...`)
    await adminClient.query(`CREATE DATABASE "${dbName}"`)
  }
  await adminClient.end()

  // 4. 确保 Prisma Client 已生成
  try {
    execSync('pnpm --filter @goferbot/server prisma:generate', { stdio: 'pipe' })
  } catch {
    console.log('[E2E] Prisma generate skipped (already exists)')
  }

  // 5. 执行 prisma migrate
  const e2eDbUrl = process.env.DATABASE_URL || 'postgresql://gofer:gofer_dev_pass@127.0.0.1:5432/goferbot_e2e?schema=public'
  console.log('[E2E] Running prisma migrate deploy...')
  execSync('npx prisma migrate deploy --schema=packages/server/prisma/schema.prisma', {
    env: { ...process.env, DATABASE_URL: e2eDbUrl },
    stdio: 'inherit',
  })
  console.log('[E2E] Database migrated')
}
