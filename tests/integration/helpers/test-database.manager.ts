import { execSync } from 'node:child_process'
import path from 'node:path'
import { Client } from 'pg'

const schemaPath = path.resolve(process.cwd(), 'packages/server/prisma/schema.prisma')
const DB_PREFIX = 'goferbot_test_'

/**
 * 进程级注册表：当前进程中由 TestDatabaseManager 创建的所有测试数据库名。
 * 用于：
 *  1) 测试被 Ctrl+C / 超时时，SIGINT/SIGTERM/exit 钩子兜底清理；
 *  2) 任何 drop 失败时仍可在 globalTeardown 重试；
 *  3) 配合 cleanupOrphanedDatabases 做历史残留清扫。
 */
const trackedDatabases = new Set<string>()
let hooksInstalled = false
let hookCleanup: (() => void) | null = null

/**
 * 安装进程级钩子，在进程退出前尽量把已创建的数据库清理掉。
 * Vitest 的 afterAll/afterEach 在 fork 池或被强制终止时可能不会执行，
 * 这里作为兜底。
 */
function installProcessHooks(): void {
  if (hooksInstalled) return
  hooksInstalled = true

  const cleanup = async (): Promise<void> => {
    const names = Array.from(trackedDatabases)
    if (names.length === 0) return
    for (const name of names) {
      try {
        const adminUrl = process.env.TEST_DATABASE_ADMIN_URL
        if (!adminUrl) continue
        const client = new Client({ connectionString: adminUrl })
        await client.connect().catch(() => null)
        try {
          await client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`).catch(() => null)
        } finally {
          await client.end().catch(() => null)
        }
        trackedDatabases.delete(name)
      } catch {
        // 单个失败不阻断其它清理
      }
    }
  }

  const handler = () => {
    // 同步路径下只能 fire-and-forget；真正的清理由 vitest globalTeardown
    // 或下次启动时的 cleanupOrphanedDatabases 完成。
    void cleanup()
  }

  process.on('SIGINT', handler)
  process.on('SIGTERM', handler)
  process.on('beforeExit', handler)

  hookCleanup = () => {
    process.removeListener('SIGINT', handler)
    process.removeListener('SIGTERM', handler)
    process.removeListener('beforeExit', handler)
  }
}

/**
 * 清理当前进程中尚未释放的测试数据库（由 globalTeardown 或一次性脚本调用）。
 */
export async function cleanupAllTrackedDatabases(): Promise<void> {
  const adminUrl = process.env.TEST_DATABASE_ADMIN_URL
  if (!adminUrl || trackedDatabases.size === 0) return
  const client = new Client({ connectionString: adminUrl })
  try {
    await client.connect()
    for (const name of Array.from(trackedDatabases)) {
      try {
        await client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`)
        trackedDatabases.delete(name)
      } catch {
        // 忽略单个失败
      }
    }
  } finally {
    await client.end().catch(() => null)
  }
}

/**
 * 列出当前数据库服务器上所有残留的 goferbot_test_* 数据库。
 */
export async function listOrphanedDatabases(adminUrl?: string): Promise<string[]> {
  const url = adminUrl ?? process.env.TEST_DATABASE_ADMIN_URL
  if (!url) throw new Error('TEST_DATABASE_ADMIN_URL is not set')
  const client = new Client({ connectionString: url })
  try {
    await client.connect()
    const res = await client.query<{ datname: string }>(
      `SELECT datname FROM pg_database WHERE datname LIKE $1`,
      [`${DB_PREFIX}%`],
    )
    return res.rows.map((r) => r.datname)
  } finally {
    await client.end().catch(() => null)
  }
}

/**
 * 一次性删除所有残留的 goferbot_test_* 数据库。
 * @param olderThanHours 仅删除创建时间超过 N 小时的库（0 表示不筛选，全部删除）
 */
export async function cleanupOrphanedDatabases(
  olderThanHours = 0,
  adminUrl?: string,
): Promise<{ dropped: string[]; skipped: string[] }> {
  const url = adminUrl ?? process.env.TEST_DATABASE_ADMIN_URL
  if (!url) throw new Error('TEST_DATABASE_ADMIN_URL is not set')
  const client = new Client({ connectionString: url })
  const dropped: string[] = []
  const skipped: string[] = []
  try {
    await client.connect()

    // 收集活跃连接的数据库，避免误删正被占用的库
    const activeRes = await client.query<{ datname: string }>(
      `SELECT DISTINCT d.datname
         FROM pg_database d
         JOIN pg_stat_activity a ON a.datname = d.datname
        WHERE d.datname LIKE $1`,
      [`${DB_PREFIX}%`],
    )
    const activeSet = new Set(activeRes.rows.map((r) => r.datname))

    const candidates = await listOrphanedDatabases(url)

    for (const name of candidates) {
      if (trackedDatabases.has(name)) {
        // 当前进程正在使用的，跳过
        skipped.push(`${name} (in use)`)
        continue
      }
      if (activeSet.has(name)) {
        skipped.push(`${name} (active connection)`)
        continue
      }
      if (olderThanHours > 0) {
        const createdAt = parseCreatedAtFromName(name)
        if (createdAt !== null && Date.now() - createdAt < olderThanHours * 3600 * 1000) {
          skipped.push(`${name} (younger than ${olderThanHours}h)`)
          continue
        }
      }
      try {
        await client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`)
        dropped.push(name)
      } catch (err) {
        skipped.push(`${name} (drop failed: ${(err as Error).message})`)
      }
    }
    return { dropped, skipped }
  } finally {
    await client.end().catch(() => null)
  }
}

/**
 * 从数据库名中解析出创建时间戳：
 *   goferbot_test_<suffix>_<timestamp>_<random>
 * 返回 null 表示无法解析。
 */
export function parseCreatedAtFromName(name: string): number | null {
  const rest = name.startsWith(DB_PREFIX) ? name.slice(DB_PREFIX.length) : name
  const parts = rest.split('_')
  if (parts.length < 2) return null
  const ts = Number(parts[parts.length - 2])
  if (!Number.isFinite(ts) || ts <= 0) return null
  return ts
}

export class TestDatabaseManager {
  constructor() {
    installProcessHooks()
  }

  async createDatabase(suffix: string): Promise<string> {
    const random = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const dbName = `${DB_PREFIX}${suffix}_${random}`
    const adminUrl = process.env.TEST_DATABASE_ADMIN_URL
    if (!adminUrl) throw new Error('TEST_DATABASE_ADMIN_URL is not set')

    const client = new Client({ connectionString: adminUrl })
    try {
      await client.connect()
      await client.query(`CREATE DATABASE "${dbName}"`)
    } finally {
      await client.end().catch(() => null)
    }

    const adminUrlObj = new URL(adminUrl)
    adminUrlObj.pathname = `/${dbName}`
    adminUrlObj.search = '?schema=public'
    const dbUrl = adminUrlObj.toString()

    let migrationSucceeded = false
    try {
      execSync(`pnpm --filter @goferbot/server exec prisma migrate deploy --schema=${schemaPath}`, {
        env: { ...process.env, DATABASE_URL: dbUrl },
        stdio: 'pipe',
      })
      migrationSucceeded = true
      trackedDatabases.add(dbName)
    } catch (err) {
      // 迁移失败立即回滚，避免孤儿库。
      // 注意：dropDatabase 内部本身可能抛错（例如连接失败），
      // 这里用独立的 try/catch 保证 trackedDatabases 一定被清理，
      // 避免影响下次 createDatabase（典型场景：一次网络故障后所有后续测试都"以为已登记"）。
      try {
        await this.dropDatabase(dbName)
      } catch {
        trackedDatabases.delete(dbName)
      }
      throw err
    }

    // 保险：如果 migrate 成功但后续在 add 到 tracked 之前进程崩溃，
    // 下次启动时 cleanupOrphanedDatabases 仍能识别并清理。
    void migrationSucceeded

    return dbUrl
  }

  async dropDatabase(dbName: string): Promise<void> {
    const adminUrl = process.env.TEST_DATABASE_ADMIN_URL
    if (!adminUrl) throw new Error('TEST_DATABASE_ADMIN_URL is not set')
    const client = new Client({ connectionString: adminUrl })
    try {
      await client.connect()
      await client.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`)
    } finally {
      await client.end().catch(() => null)
      trackedDatabases.delete(dbName)
    }
  }

  /** 当前进程尚未释放的测试数据库名（只读快照）。 */
  getTrackedDatabases(): string[] {
    return Array.from(trackedDatabases)
  }
}

export { hookCleanup }
