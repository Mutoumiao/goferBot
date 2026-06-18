/**
 * 自动清理机制验证脚本（真实环境）
 *
 * 目标：证明当测试进程被中断（afterAll 未执行）时，
 *       TestDatabaseManager + cleanupOrphanedDatabases 能正确清理残留库。
 *
 * 步骤：
 *   1) 用 TestDatabaseManager.createDatabase 创建一个测试数据库（用唯一后缀避免冲突）。
 *   2) 记录该库名，模拟"afterAll 未运行"——此时数据库已存在。
 *   3) 调用 cleanupAllTrackedDatabases 与 cleanupOrphanedDatabases 进行清理。
 *   4) 再用 pg_database 验证该库已被删除。
 *
 * 另外附加：验证 SIGINT 钩子逻辑（通过进程内的 tracked set 验证）。
 *
 * 用法：
 *   TEST_DATABASE_ADMIN_URL=... npx tsx scripts/verify-db-cleanup.ts
 *   或：pnpm db:verify-cleanup
 */
import { Client } from 'pg'
import {
  cleanupAllTrackedDatabases,
  cleanupOrphanedDatabases,
  listOrphanedDatabases,
  parseCreatedAtFromName,
  TestDatabaseManager,
} from '../tests/integration/helpers/test-database.manager.js'

const DB_PREFIX = 'goferbot_test_'

async function databaseExists(adminUrl: string, name: string): Promise<boolean> {
  const client = new Client({ connectionString: adminUrl })
  try {
    await client.connect()
    const res = await client.query<{ exists: boolean }>(
      `SELECT EXISTS (SELECT FROM pg_database WHERE datname = $1)`,
      [name],
    )
    return res.rows[0].exists
  } finally {
    await client.end().catch(() => undefined)
  }
}

function ok(msg: string): void {
  // eslint-disable-next-line no-console
  console.log(`  ✅ ${msg}`)
}

function fail(msg: string): void {
  // eslint-disable-next-line no-console
  console.log(`  ❌ ${msg}`)
}

async function main(): Promise<void> {
  const adminUrl = process.env.TEST_DATABASE_ADMIN_URL
  if (!adminUrl) {
    console.error('ERROR: TEST_DATABASE_ADMIN_URL is not set')
    process.exit(1)
  }

  const marker = `verify_${Date.now()}`
  const suffix = `verify_${marker}`

  // 0. 列出初始残留
  const beforeOrphans = await listOrphanedDatabases(adminUrl)
  // eslint-disable-next-line no-console
  console.log(`[1/5] Initial orphan count: ${beforeOrphans.length}`)

  // 1. 创建一个真实数据库（会执行 prisma migrate，确保 DB 真正存在）
  // eslint-disable-next-line no-console
  console.log(`[2/5] Creating test database with suffix="${suffix}" …`)
  const mgr = new TestDatabaseManager()
  let dbUrl: string
  try {
    dbUrl = await mgr.createDatabase(suffix)
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('createDatabase failed (可能 prisma migrate 不可用):', (err as Error).message)
    // 即便 migrate 失败，也能验证"create 后立即回滚"的逻辑
    // 若 CREATE 已成功，我们直接用 admin 连接构造库名用于后续清理验证。
    const client = new Client({ connectionString: adminUrl })
    try {
      await client.connect()
      const random = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      const dbName = `${DB_PREFIX}${suffix}_${random}`
      await client.query(`CREATE DATABASE "${dbName}"`).catch(() => undefined)
      const url = new URL(adminUrl)
      url.pathname = `/${dbName}`
      dbUrl = url.toString()
    } finally {
      await client.end().catch(() => undefined)
    }
  }

  const dbName = decodeURIComponent(new URL(dbUrl).pathname.slice(1))
  // eslint-disable-next-line no-console
  console.log(`       created: ${dbName}`)

  // 2. 验证它存在
  const existsAfterCreate = await databaseExists(adminUrl, dbName)
  if (existsAfterCreate) ok('DB exists after create')
  else fail('DB should exist after create')

  // 3. 模拟"afterAll 未执行"——进程此时若中断，tracked 里应该有该库
  const tracked = mgr.getTrackedDatabases()
  if (tracked.includes(dbName)) ok('DB is registered in tracked set')
  else fail(`DB not tracked: ${dbName} vs [${tracked.join(',')}]`)

  // 4. 方案 A: 直接调用 cleanupAllTrackedDatabases 清理
  // eslint-disable-next-line no-console
  console.log(`[3/5] Simulating globalTeardown.cleanupAllTrackedDatabases …`)
  await cleanupAllTrackedDatabases()
  const existsAfterTrackedCleanup = await databaseExists(adminUrl, dbName)
  if (!existsAfterTrackedCleanup) ok('DB removed by cleanupAllTrackedDatabases')
  else fail('DB should be removed by cleanupAllTrackedDatabases')

  // 5. 方案 B: 再创建一个并模拟"进程完全崩溃"——tracked 未注册时的孤儿清理
  // eslint-disable-next-line no-console
  console.log(`[4/5] Simulating orphan (进程崩溃/tracked 未注册) cleanup path …`)
  const client = new Client({ connectionString: adminUrl })
  const orphanName = `${DB_PREFIX}${suffix}_${Date.now()}_orphan`
  try {
    await client.connect()
    await client.query(`CREATE DATABASE "${orphanName}"`)
  } finally {
    await client.end().catch(() => undefined)
  }

  const existsAsOrphan = await databaseExists(adminUrl, orphanName)
  if (existsAsOrphan) ok('Orphan DB exists (模拟未被任何 afterAll 清理)')
  else fail('Orphan DB should exist')

  const res = await cleanupOrphanedDatabases(0, adminUrl)
  if (res.dropped.includes(orphanName)) ok(`Orphan DB dropped by cleanupOrphanedDatabases`)
  else fail(`Orphan DB not in dropped list: ${JSON.stringify(res)}`)

  const existsAfterOrphanCleanup = await databaseExists(adminUrl, orphanName)
  if (!existsAfterOrphanCleanup) ok('Orphan DB removed from pg_database')
  else fail('Orphan DB should be removed from pg_database')

  // 6. 验证 parseCreatedAtFromName 时间戳解析
  // eslint-disable-next-line no-console
  console.log(`[5/5] Verifying parseCreatedAtFromName …`)
  const now = Date.now()
  const parsed = parseCreatedAtFromName(`${DB_PREFIX}verify_ctrl_${now}_abcdef`)
  if (parsed === now) ok('parseCreatedAtFromName extracts timestamp correctly')
  else fail(`parseCreatedAtFromName mismatch: expected ${now}, got ${parsed}`)

  // 7. 最终状态
  const finalOrphans = (await listOrphanedDatabases(adminUrl)).filter((n) => n.includes(marker))
  if (finalOrphans.length === 0) ok(`No orphan DBs with marker "${marker}" remain`)
  else fail(`Orphan DBs still exist: ${finalOrphans.join(', ')}`)

  // eslint-disable-next-line no-console
  console.log('\n🎉 Auto-cleanup verification completed.')
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('FATAL:', err)
    process.exit(1)
  })
