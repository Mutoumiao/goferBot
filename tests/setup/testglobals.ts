import { installPinia } from './install-pinia'

installPinia({ stubActions: false })

global.runningTests = true

// 单元测试数据库连接保护
// 禁止单元测试连接非测试数据库，防止污染开发/生产环境
if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('_test')) {
  throw new Error(
    '[测试安全] 检测到单元测试尝试连接非测试数据库。' +
    '单元测试必须全部 Mock，禁止真实数据库连接。' +
    `违规 DATABASE_URL: ${process.env.DATABASE_URL}`
  )
}
