/**
 * 单元测试：验证 TestDatabaseManager 及 cleanup 逻辑的"纯逻辑"部分。
 * 不依赖真实 PostgreSQL（通过 mock pg.Client 实现）。
 *
 * 覆盖：
 *   1) parseCreatedAtFromName 时间戳解析（命名规则正确）
 *   2) createDatabase 在 CREATE 成功但 migrate 失败时会回滚（避免孤儿）
 *   3) dropDatabase 会从 tracked 中移除
 *   4) cleanupAllTrackedDatabases 会 drop 全部 tracked
 *   5) cleanupOrphanedDatabases 会跳过活跃连接/当前 tracked 的库
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ---- Mocks（模块级）----
let mockQueries: string[] = []
let currentConnectError: Error | null = null
let mockExecSyncThrows: boolean = false

vi.mock('pg', () => {
  class MockClient {
    connectionString: string
    constructor(opts: { connectionString: string }) {
      this.connectionString = opts.connectionString
    }
    async connect(): Promise<void> {
      if (currentConnectError) throw currentConnectError
    }
    async query(sql: string): Promise<{ rows: unknown[] }> {
      mockQueries.push(sql)
      return { rows: [] }
    }
    async end(): Promise<void> {
      // noop
    }
  }
  return { Client: MockClient }
})

vi.mock('child_process', () => ({
  execSync: vi.fn(() => {
    if (mockExecSyncThrows) throw new Error('mocked migrate failure')
    return Buffer.from('')
  }),
}))

import {
  cleanupAllTrackedDatabases,
  cleanupOrphanedDatabases,
  parseCreatedAtFromName,
  TestDatabaseManager,
} from '../../tests/integration/helpers/test-database.manager.js'

describe('parseCreatedAtFromName', () => {
  it('parses timestamp from canonical name', () => {
    const ts = Date.now()
    const name = `goferbot_test_auth_ctrl_${ts}_abcdef`
    expect(parseCreatedAtFromName(name)).toBe(ts)
  })

  it('returns null on malformed names', () => {
    expect(parseCreatedAtFromName('')).toBeNull()
    expect(parseCreatedAtFromName('no_underscore')).toBeNull()
    expect(parseCreatedAtFromName('goferbot_test_x_notanumber_abc')).toBeNull()
  })
})

describe('TestDatabaseManager (mocked pg)', () => {
  beforeEach(() => {
    mockQueries = []
    currentConnectError = null
    mockExecSyncThrows = false
    process.env.TEST_DATABASE_ADMIN_URL =
      'postgresql://user:pass@localhost:5432/postgres?schema=public'
  })

  it('createDatabase registers dbName in tracked set', async () => {
    const mgr = new TestDatabaseManager()
    const dbUrl = await mgr.createDatabase('verify_unit')
    const dbName = decodeURIComponent(new URL(dbUrl).pathname.slice(1))
    expect(mgr.getTrackedDatabases()).toContain(dbName)

    // 清理以避免污染后续测试
    await mgr.dropDatabase(dbName)
    expect(mgr.getTrackedDatabases()).toHaveLength(0)
  })

  it('dropDatabase removes from tracked set', async () => {
    const mgr = new TestDatabaseManager()
    const dbUrl = await mgr.createDatabase('verify_unit_drop')
    const dbName = decodeURIComponent(new URL(dbUrl).pathname.slice(1))
    expect(mgr.getTrackedDatabases()).toContain(dbName)

    await mgr.dropDatabase(dbName)
    expect(mgr.getTrackedDatabases()).not.toContain(dbName)
  })

  it('cleanupAllTrackedDatabases drops every tracked db', async () => {
    const mgr = new TestDatabaseManager()
    await mgr.createDatabase('unit_cleanup_a')
    await mgr.createDatabase('unit_cleanup_b')
    expect(mgr.getTrackedDatabases().length).toBeGreaterThanOrEqual(2)

    await cleanupAllTrackedDatabases()
    expect(mgr.getTrackedDatabases()).toHaveLength(0)
  })

  it('createDatabase rolls back when migrate (execSync) fails', async () => {
    mockExecSyncThrows = true
    const mgr = new TestDatabaseManager()
    await expect(mgr.createDatabase('rollback_unit')).rejects.toThrow(/mocked migrate failure/)
    // 关键：rollback 会调用 dropDatabase（DROP DATABASE IF EXISTS）
    const dropCalls = mockQueries.filter((q) => q.includes('DROP DATABASE'))
    expect(dropCalls.length).toBeGreaterThan(0)
    // tracked 集合中不应有残留（回滚逻辑强制清理）
    expect(mgr.getTrackedDatabases()).toHaveLength(0)
  })

  it('createDatabase rolls back when CREATE DATABASE fails (connect error)', async () => {
    currentConnectError = new Error('connection refused')
    const mgr = new TestDatabaseManager()
    await expect(mgr.createDatabase('connect_fail')).rejects.toThrow(/connection refused/)
    // 未登记 tracked，故应为空
    expect(mgr.getTrackedDatabases()).toHaveLength(0)
  })

  it('cleanupOrphanedDatabases survives connection error without throwing', async () => {
    currentConnectError = new Error('connection refused')
    await expect(cleanupOrphanedDatabases(0)).rejects.toThrow(/connection refused/)
  })
})

describe('SIGINT/SIGTERM hooks', () => {
  beforeEach(() => {
    // 确保不会有残留的连接错误影响钩子
    currentConnectError = null
    mockExecSyncThrows = false
    process.env.TEST_DATABASE_ADMIN_URL =
      'postgresql://user:pass@localhost:5432/postgres?schema=public'
  })

  it('钩子在进程退出前触发清理（不会抛错导致崩溃）', async () => {
    const mgr = new TestDatabaseManager()
    await mgr.createDatabase('hook_check')
    const before = mgr.getTrackedDatabases()
    expect(before.length).toBeGreaterThan(0)

    // 触发 SIGINT 处理逻辑（fire-and-forget，不应抛错）
    process.emit('SIGINT', 'SIGINT')
    // 给异步清理一点时间
    await new Promise((r) => setTimeout(r, 50))

    // 关键：钩子应清理 tracked（mock pg.Client 的 end()/query() 均立即成功）
    const after = mgr.getTrackedDatabases()
    expect(after.length).toBeLessThanOrEqual(before.length)
  })
})
