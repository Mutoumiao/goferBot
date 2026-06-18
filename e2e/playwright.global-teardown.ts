/**
 * Playwright globalTeardown: 在所有 E2E 测试结束后清理数据库。
 *
 * 职责：
 * 1. 清理 goferbot_e2e 数据库中所有业务表的数据
 * 2. 避免测试数据累积
 */
import { cleanupDatabase } from './fixtures/auth'

export default async function globalTeardown(): Promise<void> {
  try {
    await cleanupDatabase()
    console.log('[globalTeardown] Database cleanup completed')
  } catch (error) {
    console.error('[globalTeardown] Database cleanup failed:', error)
    // 不抛出错误，避免阻塞测试报告生成
  }
}
