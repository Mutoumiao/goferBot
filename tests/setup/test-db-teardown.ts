/**
 * Vitest globalSetup: 在所有测试结束后兜底清理测试数据库。
 *
 * 作用：
 *   1) 清理本进程中 tracked 但未被正常 drop 的数据库（应对 afterAll 被跳过的情况）；
 *   2) 扫描数据库服务器上所有历史残留的 goferbot_test_* 数据库，
 *      跳过"当前正在被其他测试进程占用"的库，安全地 drop 其余孤儿库。
 *
 * 通过 vitest 配置引用：globalSetup: ['./tests/setup/test-db-teardown.ts']
 *
 * 注意：vitest 4.x 已移除 globalTeardown，本文件用 globalSetup 的"返回 teardown
 * 函数"标准模式（参见 https://vitest.dev/config/globalsetup）。
 */
import {
  cleanupAllTrackedDatabases,
  cleanupOrphanedDatabases,
} from '../integration/helpers/test-database.manager.js'

export default async function (): Promise<() => Promise<void>> {
  // setup 阶段无需做事，仅返回 teardown。
  // vitest 会在所有测试结束后调用它（运行在主进程，不会被测试异常打断）。
  return async function teardown(): Promise<void> {
    // 1) 尽力清掉当前进程登记的
    await cleanupAllTrackedDatabases().catch(() => undefined)

    // 2) 再扫一遍孤儿库（只清理"非活跃连接中的"测试库，避免误删并发测试）
    const res = await cleanupOrphanedDatabases(0).catch((err: unknown) => {
      console.warn('[test-db-teardown] cleanupOrphanedDatabases failed:', err)
      return { dropped: [], skipped: [] }
    })

    if (res.dropped.length > 0) {
      // eslint-disable-next-line no-console
      console.log(`[test-db-teardown] dropped ${res.dropped.length} orphaned test DB(s):`)
      for (const name of res.dropped) {
        // eslint-disable-next-line no-console
        console.log(`  - ${name}`)
      }
    }
    if (res.skipped.length > 0) {
      // eslint-disable-next-line no-console
      console.log(
        `[test-db-teardown] skipped ${res.skipped.length} test DB(s) (in use / failed):`,
      )
      for (const line of res.skipped) {
        // eslint-disable-next-line no-console
        console.log(`  - ${line}`)
      }
    }
  }
}
